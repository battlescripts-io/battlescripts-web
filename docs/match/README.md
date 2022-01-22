# What Is This?

This is a stand-alone Match Viewer interface.

It contains a canvas view, and provides a postMessage API to load game state and update the canvas renderer components.

This is a stand-alone interface that can be embedded into editors or used to view a completed match with 1+ games received as JSON.

Controls are provided to navigate the game states. State is editable and can be changed to refresh the canvas rendering. GameDirective and Results are not editable.

When the page is loaded and ready, it makes a postMessage call of 'match/ready'.

The page listens for postMessage calls containing a data object to update state and contents. Any or all of the attributes may be included:

```
{
  js: "code",
  html: "<html>",
  css: "css",
  state: { },
  gamedirective: { },
  results: { }
}
```
