# FeedWordsSensitive · `spec:design:behavior-feed-words-sensitive`

ALWAYS a words-only post marked sensitive draws its words blurred in place with Show beside them GIVEN the reader has not revealed it this session

ALWAYS the line The author's warning stands under the blurred words and their Show GIVEN the author marked the post, with the reason after an em dash where the author gave one

ALWAYS the line The platform's verdict stands under the blurred words and their Show GIVEN the platform's verdict marked the post, with the reason after an em dash where the verdict carries one

ALWAYS the post's title, author, timestamp, opinion, score, comment count and share stay readable outside the veil

ALWAYS the blurred words keep their exact space under the veil

WHEN tap Show -> the words unveil in place AND the source line goes

WHEN tap Show -> every veil in the post reveals together AND the reveal holds for the rest of the session

ALWAYS the source line stands once per post GIVEN the words are the post's whole body
