# ComposeSealUploading · `spec:design:behavior-compose-seal-uploading`

ALWAYS the line Uploading N of M — signing waits for the pictures. stands above Sign and publish GIVEN an upload is running

ALWAYS Sign and publish stays visible and inert GIVEN an upload is running

WHEN press Sign and publish GIVEN an upload is running -> NEVER anything is signed

WHEN the last upload lands -> the upload line goes AND Sign and publish answers

ALWAYS every act the signature commits is read back in the acts card while the uploads run

WHEN press the header back arrow -> the details stage comes back with its uploads running

WHEN press Back -> the details stage comes back with its uploads running

WHEN press the header X -> the whole flow is left AND the draft is kept AND the uploads finish quietly AND NEVER a dialog asks
