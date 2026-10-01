# ComposeUploading · `spec:design:behavior-compose-uploading`

ALWAYS each picture still uploading wears its progress as a ring on its thumbnail

ALWAYS the line Pictures upload while you write — signing waits for them. stands above Next GIVEN an upload is running

ALWAYS the picked row carries no crop or edit shortcut of its own

WHEN a picture's upload fails -> its thumbnail is marked AND the line One picture didn't upload. stands under the row with Retry and Remove it

WHEN press Retry -> the failed upload tries again

WHEN press Remove it -> the failed picture leaves the batch

WHEN tap Describe the pictures GIVEN an upload is running -> the describe sheet opens AND NEVER describing waits on the upload

WHEN typing in the title or the description GIVEN an upload is running -> NEVER the writing waits on the upload

WHEN press Next GIVEN an upload is still running -> the seal opens gated on the uploads

WHEN press Next GIVEN every upload has landed -> the seal opens ungated

WHEN press the header back arrow -> the crop comes back, one stage behind

WHEN press the header X -> the whole flow is left AND the draft is kept AND the uploads finish quietly AND NEVER a dialog asks
