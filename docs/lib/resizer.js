const resizable = function(resizer, callback) {
  const direction = resizer.getAttribute('data-direction') || 'horizontal';
  const resizePanel = resizer.getAttribute('data-resize') || 'previous';
  let prevSibling = resizer.previousElementSibling;
  let nextSibling = resizer.nextElementSibling;
  let resizeDirection = 1;
  if ("next"===resizePanel) {
    prevSibling = resizer.nextElementSibling;
    nextSibling = resizer.previousElementSibling;
    resizeDirection = -1;
  }

  // The current position of mouse
  let x = 0;
  let y = 0;
  let prevSiblingHeight = 0;
  let prevSiblingWidth = 0;

  // Handle the mousedown event
  // that's triggered when user drags the resizer
  const mouseDownHandler = function(e) {
    // Get the current mouse position
    x = e.clientX;
    y = e.clientY;
    const rect = prevSibling.getBoundingClientRect();
    prevSiblingHeight = rect.height;
    prevSiblingWidth = rect.width;
    if (typeof callback=="function") {
      callback('start');
    }

    // Attach the listeners to `document`
    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
  };

  const mouseMoveHandler = function(e) {
    // How far the mouse has been moved
    const dx = e.clientX - x;
    const dy = e.clientY - y;
    switch (direction) {
      case 'vertical':
        //const h = (prevSiblingHeight + (dy*resizeDirection)) * 100 / resizer.parentNode.getBoundingClientRect().height;
        //prevSibling.style.height = `${h}%`;
        const h = (prevSiblingHeight + (dy*resizeDirection));
        prevSibling.style.height = `${h}px`;
        break;
      case 'horizontal':
      default:
        //const w = (prevSiblingWidth + (dx*resizeDirection)) * 100 / resizer.parentNode.getBoundingClientRect().width;
        //prevSibling.style.width = `${w}%`;
        const w = (prevSiblingWidth + (dx*resizeDirection));
        prevSibling.style.width = `${w}px`;
        prevSibling.style.flexBasis = `${w}px`;

        break;
    }

    const cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    resizer.style.cursor = cursor;
    document.body.style.cursor = cursor;

    prevSibling.style.userSelect = 'none';
    prevSibling.style.pointerEvents = 'none';

    nextSibling.style.userSelect = 'none';
    nextSibling.style.pointerEvents = 'none';
  };

  const mouseUpHandler = function() {
    resizer.style.removeProperty('cursor');
    document.body.style.removeProperty('cursor');

    prevSibling.style.removeProperty('user-select');
    prevSibling.style.removeProperty('pointer-events');

    nextSibling.style.removeProperty('user-select');
    nextSibling.style.removeProperty('pointer-events');

    // Remove the handlers of `mousemove` and `mouseup`
    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseup', mouseUpHandler);

    if (typeof callback=="function") {
      callback('end');
    }
  };

  // Attach the handler
  resizer.addEventListener('mousedown', mouseDownHandler);
};
