# ComposePickedErrors · `spec:design:behavior-compose-picked-errors`

ALWAYS what was accepted stands in the tray and what was refused is listed under it, one line per refused file

ALWAYS a refused file never joins the batch

ALWAYS a refused file's only way out is Remove it, never Retry

ALWAYS a cap is enforced in MiB and written on screen in MB

WHEN a picked file is judged -> its size and format answer first AND the body's grammar answers second AND the line names the nearest reason

WHEN a picture over 10 MiB is picked -> it is refused with That picture is too big — a picture can be up to 10 MB.

WHEN a video over 100 MiB is picked -> it is refused with That video is too big — a post's video can be up to 100 MB.

WHEN a file nothing here reads is picked -> it is refused with That file isn't a picture or a video CoGra can read.

WHEN a moving GIF is picked -> it is refused with That GIF moves, and CoGra can't take a moving GIF here. A still one is fine.

WHEN a still GIF is picked -> it is converted on the device AND NEVER refused

WHEN a video is picked GIVEN pictures are in the tray -> it is refused with A post carries pictures or one video, not both.

WHEN a picture is picked GIVEN ten pictures are in the tray -> it is refused with That's more than a post carries — up to ten pictures.

WHEN press Remove it on a refused file -> its refusal leaves the list

WHEN press Next -> what was accepted goes on to the crop

WHEN tap Show all -> the Show all sheet opens on the accepted pictures alone

WHEN press the header back arrow -> the wizard leaves toward where compose began AND the draft is kept AND NEVER a dialog asks

WHEN press the header X -> the whole flow is left AND the draft is kept AND NEVER a dialog asks

WHEN tap Write words instead GIVEN the body holds pictures or a clip -> an ask to discard the body opens over the stage AND NEVER the body switches before the ask is answered

WHEN tap Write words instead GIVEN the body is empty -> the words stage opens AND NEVER an ask opens
