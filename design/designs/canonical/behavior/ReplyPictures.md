# ReplyPictures · `spec:design:behavior-reply-pictures`

ALWAYS a reply's pictures join the words as uncropped whole frames

ALWAYS a reply holds at most four pictures

WHEN a picture is picked -> it starts uploading at once AND NEVER a crop step opens

ALWAYS the add control counts the pictures against the cap, as in + Add pictures · 2 of 4

WHEN tap a picture's remove control -> the picture leaves the tray

ALWAYS each picture still uploading wears its progress as a ring on its thumbnail

WHEN a picture's upload fails -> its thumbnail is marked AND the line One picture didn't upload. stands under the pictures with Retry and Remove it AND the failed tile loses its own remove control AND Next is disabled AND the line Words first — pictures can join them, and they upload while you write. goes

WHEN press Retry under the pictures -> the failed picture's upload tries again AND its ring returns AND the line goes AND Next answers again

WHEN press Remove it under the pictures -> the failed picture leaves the tray AND the line goes AND Next answers again AND NEVER another picture leaves

WHEN press Next GIVEN a picture's upload failed -> NEVER the seal opens
