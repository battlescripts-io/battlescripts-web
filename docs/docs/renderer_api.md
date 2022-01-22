# Renderer API

A Renderer accepts GameState and displays it visually in HTML.

There are 3 different ways you can choose from to create a Renderer:

1. A javascript render() function that accepts state and returns HTML
2. Static HTML that gets manipulated by your javascript render() function
3. A Vue.js template that binds to your state to render the HTML

## Rendering Methods

#### render(GameState): HTML?

Methods #1 and #2 are supported by the render() function, which is passed your JSON GameState. Your Renderer's index.js is a module that exports a single function which will be your render() method.

If it returns a String, that will be interpreted as HTML and replace the &lt;body&gt; content entirely.

If it doesn't return a String, then it is assumed that your method just manipulated the HTML that already exists in index.html and the &lt;body&gt; content is not replaced.

#### Vue.js Template

If your renderer does not export a render() method, then the contents of index.html are interpreted as a Vue template. This template is mounted to &lt;body&gt; and its data contains a "state" property. Use this property to loop over structures in your game state, display values, etc.

To debug, you can simple use {{state}} in index.html to output the entire state structure.

If a render() function does exist, then the content of index.html will be inserted as the &lt;body&gt; of the page and your function can manipulate it to render the game.

## Sandbox

Your Renderer will always run in a sandboxed &lt;iframe&gt;, which isolates it from code and css in the containing page. You completely own the HTML in the page and can apply any css or insert any HTML you wish. Your renderer cannot communicate with anything outside its own page.

## Scaling

Your game may be rendered at any resolution and any aspect ratio, which is out of your control. You should use media queries and/or relative sizing units to decide how to display your game. It is recommended to rely entirely on vw and vh units in css so your game can adapt to any screen size.

In most envronments, you can assume that your display area will be horizontal rather than vertical.

## Images

Static images are not supported because they require hosting and a reference. Instead, use css images with data: URI's so the images you need are encoded in the css itself.

## Colors and Variables

Your game may use any colors you wish, but to encourage consistency of look and feel, some css variables will be inserted into your renderer output by default. You can choose to use them if you wish.

The css variables --p1 through --p6 are defined as colors. You can use them in your Renderer css like this, for example:

```
.player-1 {
  background-color:var(--p1);
}
```

## Assumptions

You are safe to make some assumptions about your Renderer. 

1. It will be rendered in a modern browser such as the most recent version of Chrome
2. calculate() is supported
3. The html and body elements have 0 margin and 0 padding by default
