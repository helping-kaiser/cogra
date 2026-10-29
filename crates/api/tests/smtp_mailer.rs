//! The SMTP mailer against a real SMTP conversation (production-deploy
//! O-1, O-2): a sink on the loopback interface speaks just enough of RFC
//! 5321 to accept, refuse, stall or ignore, and records what arrived. The
//! client side is the production path end to end — the environment read,
//! lettre's pooled tokio transport, the seam's send. Nothing leaves the
//! machine.

use std::sync::Arc;
use std::time::{Duration, Instant};

use api::mailer::smtp::DeliveryError;
use api::mailer::{Mail, Mailer, MailerConfig, SmtpConfig, SmtpMailer};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;
use tokio::sync::mpsc;

/// What the sink does with a connection.
#[derive(Clone, Copy)]
enum Behaviour {
    /// Greets, accepts every command and queues every message.
    Accept,
    /// As `Accept`, but answers every recipient with a permanent 550.
    RefuseRecipient,
    /// As `Accept`, but greets only after the delay.
    SlowGreeting(Duration),
    /// Accepts the connection and never says a word.
    Silent,
}

/// One message as the sink received it.
#[derive(Debug)]
struct Received {
    mail_from: String,
    rcpt_to: Vec<String>,
    data: String,
}

/// A sink on 127.0.0.1 at a free port, and the messages it queues.
async fn sink(behaviour: Behaviour) -> (u16, mpsc::UnboundedReceiver<Received>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let port = listener.local_addr().expect("addr").port();
    let (tx, rx) = mpsc::unbounded_channel();
    tokio::spawn(async move {
        while let Ok((socket, _)) = listener.accept().await {
            tokio::spawn(converse(socket, behaviour, tx.clone()));
        }
    });
    (port, rx)
}

/// The server half of one SMTP session.
async fn converse(
    socket: tokio::net::TcpStream,
    behaviour: Behaviour,
    queue: mpsc::UnboundedSender<Received>,
) {
    let (read, mut write) = socket.into_split();
    let mut lines = BufReader::new(read);
    match behaviour {
        Behaviour::Silent => {
            let mut sink = String::new();
            while lines.read_line(&mut sink).await.is_ok_and(|n| n > 0) {}
            return;
        }
        Behaviour::SlowGreeting(delay) => tokio::time::sleep(delay).await,
        Behaviour::Accept | Behaviour::RefuseRecipient => {}
    }
    let reply = |text: &str| format!("{text}\r\n");
    if write
        .write_all(reply("220 sink ESMTP").as_bytes())
        .await
        .is_err()
    {
        return;
    }
    let (mut mail_from, mut rcpt_to) = (String::new(), Vec::new());
    loop {
        let mut line = String::new();
        if lines.read_line(&mut line).await.unwrap_or(0) == 0 {
            return;
        }
        let command = line.trim_end().to_string();
        let upper = command.to_ascii_uppercase();
        let answer = if upper.starts_with("EHLO") || upper.starts_with("HELO") {
            "250-sink\r\n250 8BITMIME".to_string()
        } else if let Some(rest) = upper.strip_prefix("MAIL FROM:") {
            mail_from = command[command.len() - rest.len()..]
                .split_whitespace()
                .next()
                .unwrap_or_default()
                .to_string();
            "250 OK".to_string()
        } else if upper.starts_with("RCPT TO:") {
            if matches!(behaviour, Behaviour::RefuseRecipient) {
                "550 5.1.1 no such user here".to_string()
            } else {
                rcpt_to.push(command["RCPT TO:".len()..].trim().to_string());
                "250 OK".to_string()
            }
        } else if upper == "DATA" {
            if write
                .write_all(reply("354 go ahead").as_bytes())
                .await
                .is_err()
            {
                return;
            }
            let mut data = String::new();
            loop {
                let mut body_line = String::new();
                if lines.read_line(&mut body_line).await.unwrap_or(0) == 0 {
                    return;
                }
                if body_line == ".\r\n" {
                    break;
                }
                data.push_str(body_line.strip_prefix('.').unwrap_or(&body_line));
            }
            let _ = queue.send(Received {
                mail_from: std::mem::take(&mut mail_from),
                rcpt_to: std::mem::take(&mut rcpt_to),
                data,
            });
            "250 OK queued".to_string()
        } else if upper == "RSET" {
            mail_from.clear();
            rcpt_to.clear();
            "250 OK".to_string()
        } else if upper == "NOOP" {
            "250 OK".to_string()
        } else if upper == "QUIT" {
            let _ = write.write_all(reply("221 bye").as_bytes()).await;
            return;
        } else {
            "502 not implemented".to_string()
        };
        if write.write_all(reply(&answer).as_bytes()).await.is_err() {
            return;
        }
    }
}

/// The configuration the environment would name for the sink.
fn config(port: u16, timeout_secs: u64) -> SmtpConfig {
    let url = format!("smtp://127.0.0.1:{port}");
    let timeout = timeout_secs.to_string();
    let vars = [
        ("MAILER", "smtp"),
        ("SMTP_URL", url.as_str()),
        ("MAIL_FROM", "CoGra <no-reply@cogra.example>"),
        ("SMTP_TIMEOUT_SECS", timeout.as_str()),
    ];
    match MailerConfig::from_lookup(|key| {
        vars.iter()
            .find(|(k, _)| *k == key)
            .map(|(_, v)| (*v).to_string())
    }) {
        Ok(MailerConfig::Smtp(smtp)) => smtp,
        other => panic!("the sink's environment reads as SMTP: {other:?}"),
    }
}

fn mail() -> Mail {
    Mail {
        to: "reader@example.org".into(),
        subject: "Verify your CoGra email".into(),
        body: "Verify your email: https://cogra.example/verify?token=abc123".into(),
    }
}

async fn next(queue: &mut mpsc::UnboundedReceiver<Received>) -> Received {
    tokio::time::timeout(Duration::from_secs(10), queue.recv())
        .await
        .expect("the sink received a message within 10 s")
        .expect("the sink is running")
}

/// The boot path end to end: the environment names SMTP, the built mailer
/// sends through the seam, and the server receives one message whose
/// envelope runs from MAIL_FROM to the recipient and whose content carries
/// the sender, the recipient, the subject and the body.
///
/// The configured SMTP mailer delivers the envelope and the message to the server.
/// ´claim:mail:smtp-delivers-through-a-server´
#[tokio::test]
async fn the_smtp_mailer_delivers_through_a_server() {
    let (port, mut queue) = sink(Behaviour::Accept).await;
    let mailer = api::mailer::build(MailerConfig::Smtp(config(port, 5))).expect("mailer");

    mailer.send(mail()).await;
    let received = next(&mut queue).await;

    assert_eq!(received.mail_from, "<no-reply@cogra.example>");
    assert_eq!(received.rcpt_to, vec!["<reader@example.org>".to_string()]);
    let data = received.data;
    assert!(
        data.contains("From: CoGra <no-reply@cogra.example>\r\n"),
        "{data}"
    );
    assert!(data.contains("To: reader@example.org\r\n"), "{data}");
    assert!(
        data.contains("Subject: Verify your CoGra email\r\n"),
        "{data}"
    );
    assert!(
        data.contains("Content-Type: text/plain; charset=utf-8\r\n"),
        "{data}"
    );
    assert!(
        data.contains("\r\n\r\nVerify your email: https://cogra.example/verify?token=abc123"),
        "{data}"
    );
}

/// The seam's send returns while the server has not even greeted, and the
/// message still arrives afterwards — so a flow that mails answers in the
/// same time as one that does not, which is what keeps the silent verbs
/// from revealing which addresses have accounts.
///
/// The seam's send returns before the SMTP server answers, and the mail still arrives.
/// ´claim:mail:smtp-send-returns-before-the-server-answers´
#[tokio::test]
async fn send_returns_before_the_server_answers() {
    let (port, mut queue) = sink(Behaviour::SlowGreeting(Duration::from_millis(1500))).await;
    let mailer: Arc<dyn Mailer> =
        Arc::new(SmtpMailer::from_config(&config(port, 5)).expect("mailer"));

    let started = Instant::now();
    mailer.send(mail()).await;
    let returned_after = started.elapsed();
    assert!(
        returned_after < Duration::from_millis(500),
        "send returned after {returned_after:?}"
    );

    let received = next(&mut queue).await;
    assert!(
        started.elapsed() >= Duration::from_millis(1500),
        "delivered only after the greeting"
    );
    assert_eq!(received.rcpt_to, vec!["<reader@example.org>".to_string()]);
}

/// A server that refuses the recipient fails the delivery with its own
/// answer, which is what the error line carries.
///
/// A recipient the server refuses fails the delivery with the server's answer.
/// ´claim:mail:a-refused-recipient-fails-the-delivery´
#[tokio::test]
async fn a_refused_recipient_fails_the_delivery() {
    let (port, mut queue) = sink(Behaviour::RefuseRecipient).await;
    let mailer = SmtpMailer::from_config(&config(port, 5)).expect("mailer");

    let outcome = mailer.deliver(mail()).await;
    let Err(DeliveryError::Transport(cause)) = outcome else {
        panic!("a refused recipient is a transport failure: {outcome:?}");
    };
    assert!(cause.to_string().contains("550"), "{cause}");
    assert!(queue.try_recv().is_err(), "nothing was queued");
}

/// A server that accepts the connection and never answers is given up on
/// within the configured timeout, so a stalled provider never holds a
/// delivery task.
///
/// A silent server is given up on within SMTP_TIMEOUT_SECS.
/// ´claim:mail:a-silent-server-times-out´
#[tokio::test]
async fn a_silent_server_times_out() {
    let (port, _queue) = sink(Behaviour::Silent).await;
    let mailer = SmtpMailer::from_config(&config(port, 1)).expect("mailer");

    let started = Instant::now();
    let outcome = mailer.deliver(mail()).await;
    let elapsed = started.elapsed();
    assert!(outcome.is_err(), "a silent server delivers nothing");
    assert!(
        elapsed < Duration::from_secs(3),
        "gave up after {elapsed:?} on a 1 s timeout"
    );
}
