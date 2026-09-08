The crop step's surface: the picture, the window it will be cut to, and the darkened remainder.

```jsx
<CropViewport src="portrait.jpg" shape="circle" scale={1.2} origin="50% 35%"/>
<CropViewport src="frame.jpg" shape="rect" height={192} scale={1.15} origin="50% 45%"/>
```

**The shape is locked to how the result will be seen**, never chosen here. A profile picture appears in a circle everywhere, so it is cut in a circle. A video's cover appears at the clip's ratio, so it is cut at that ratio — the clip's own in a post, the comment pager's square in a comment. Shape chips on a crop step let the result disagree with the thing it is the face of.

**State the window's height, never its position.** It is inset from both gutters and centred in what remains, so `height={192}` is the whole of a 16:9 cover and the circle needs nothing at all.

`scale` and `origin` are the picture's zoom and position under the window — what pinching and dragging would change on a live surface. A frame cut from the clip needs no crop at all: it already carries the clip's shape, so only a picture of your own is ever asked to fit.

The step's words live outside the viewport: "Drag to move, pinch to zoom." and then the line that says what the crop is for.
