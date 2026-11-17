# ReplyPictures · `spec:design:behavior-reply-pictures`

ALWAYS a reply's pictures join the words as the squares their author framed, each tile in the tray a square

ALWAYS a reply holds at most four pictures

WHEN pictures come back from the platform's picker -> the comment's square crop opens on them AND NEVER a pick stage opens

WHEN press Next on the comment's square crop -> the pictures join the tray as their squares AND their cropped exports start uploading AND NEVER an uncropped picture leaves the device

WHEN tap + Add pictures GIVEN the tray holds pictures -> the crop opens on the new pictures only AND every picture already in the tray keeps the framing it was given

ALWAYS the add control counts the pictures against the cap, as in + Add pictures · 2 of 4

WHEN tap a picture's remove control -> the picture leaves the tray

ALWAYS each picture still uploading wears its progress as a ring on its thumbnail

WHEN a picture's upload fails -> its thumbnail is marked AND the line One picture didn't upload. stands under the pictures with Retry and Remove it AND the failed tile loses its own remove control AND Next is disabled AND the line Words first — pictures can join them, and they upload while you write. goes

WHEN the server refuses a picture at its upload -> the line One picture didn't upload. stands under the row with Remove it alone AND NEVER Retry stands, retrying being unable to change the answer

WHEN press Retry under the pictures -> the failed picture's upload tries again AND its ring returns AND the line goes AND Next answers again

WHEN press Remove it under the pictures -> the failed picture leaves the tray AND the line goes AND Next answers again AND NEVER another picture leaves

WHEN press Next GIVEN a picture's upload failed -> NEVER the seal opens
