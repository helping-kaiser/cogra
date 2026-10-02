# ComposeSealUploading · `spec:design:behavior-compose-seal-uploading`

ALWAYS the line Uploading N of M — signing waits for the pictures. stands above Sign and publish GIVEN pictures are uploading

ALWAYS the line Uploading N of M — signing waits for the video. stands above Sign and publish GIVEN a clip is uploading

ALWAYS Sign and publish stays visible GIVEN an upload is running

WHEN press Sign and publish GIVEN an upload is running -> the press is held for the uploads AND NEVER anything is signed before the last upload lands

WHEN the last upload lands GIVEN Sign and publish was pressed while the uploads ran -> signing proceeds AND NEVER a second press is asked

WHEN the last upload lands GIVEN Sign and publish was not pressed -> the upload line goes AND Sign and publish answers

ALWAYS every act the signature commits is read back in the acts card while the uploads run

WHEN press the header back arrow -> the details stage comes back with its uploads running

WHEN press Back -> the details stage comes back with its uploads running

WHEN press the header X -> the whole flow is left AND the draft is kept AND the uploads finish quietly AND NEVER a dialog asks
