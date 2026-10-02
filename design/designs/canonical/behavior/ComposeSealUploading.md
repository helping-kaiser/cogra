# ComposeSealUploading · `spec:design:behavior-compose-seal-uploading`

ALWAYS the line Uploading N of M — signing waits for the pictures. stands above Sign and publish GIVEN pictures are uploading

ALWAYS the line Uploading N of M — signing waits for the video. stands above Sign and publish GIVEN a clip is uploading

ALWAYS Sign and publish is enabled GIVEN an upload is running

WHEN press Sign and publish GIVEN an upload is running -> Sign and publish refuses a second press AND NEVER anything is signed before the last upload lands AND NEVER Sign and publish dims

WHEN the signing has not answered 200ms after the press GIVEN Sign and publish was pressed while the uploads ran -> Sign and publish reads Signing and publishing… in its own place AND the header back arrow, Back and the header X refuse a press AND NEVER a spinner appears

WHEN the signing has not answered 5s after the press GIVEN Sign and publish was pressed while the uploads ran -> the subline under the total reads Still signing — the network is slow right now. AND NEVER a progress indicator appears

WHEN the last upload lands GIVEN Sign and publish was pressed while the uploads ran -> signing proceeds AND NEVER a second press is asked

WHEN the last upload lands GIVEN Sign and publish was not pressed -> the upload line goes AND Sign and publish stays as it was

ALWAYS every act the signature commits is read back in the acts card while the uploads run

WHEN press the header back arrow GIVEN Sign and publish was not pressed -> the details stage comes back with its uploads running

WHEN press Back GIVEN Sign and publish was not pressed -> the details stage comes back with its uploads running

WHEN press the header X GIVEN Sign and publish was not pressed -> the whole flow is left AND the draft is kept AND the uploads finish quietly AND NEVER a dialog asks
