// Abstraction to send a postMessage to our container
function sendMessage(msg) {
  let allowed_domain = '*';
  if (parent && parent!==self) {
    parent.postMessage(msg,allowed_domain);
  }
  if (opener) {
    opener.postMessage(msg,allowed_domain);
  }
}

// TODO: Validate the origin of any received message
function validateOrigin(msg) {
  return true;
}

// On load, tell the controlling window that we're ready
addEventListener('load',function() {
  //console.log("Canvas sending ready message");
  sendMessage('canvas/ready');
});

// The last state passed in, so if we need to re-construct the rendering we use this
let current_state = {};
// Store the template HTML for some edge cases
let current_html = null;

// Setup Vue in case the renderer needs it
let VueApp = null;
let $VueData = null;
$(mount_vue);
function handleVueTemplateError(err) {
  let note ='';
  if (/TypeError: can't access property "created"/.test(err)) {
    note = "This is often caused by a typo in or an unknown directive.";
  }
  document.body.innerHTML =`
    <h2>Vue Template Error</h2>
    <pre>${err}</pre>
    <p>${note}</p>
  `;
}
async function mount_vue() {
  if (typeof render!="function" && !VueApp) {
    VueApp = Vue.createApp({
      data() {
        return { state: current_state };
      }
    });
  }
  if (VueApp) {
    // There are two ways to handle different template errors
    // The global errorHandler catches some, and mount() throws some
    try {
      VueApp.config.errorHandler = function(err, vm, info) {
        handleVueTemplateError(err.toString());
        return false;
      };
      $VueData = await VueApp.mount(document.body);
    } catch(err) {
      handleVueTemplateError(err.toString());
    }
  }
}
function unmount_vue() {
  if (VueApp) {
    VueApp.unmount();
    VueApp = null;
    $VueData = null;
  }
}

function update_js(js) {
  let code = `(()=>{ 
    window.render = null; 
    let module={exports:null}; 
    try {
      ${js}; 
      window.render = module.exports;
    } catch(e) {
      window.render = null;
    }
  })();`;
  try {
    eval(code);
  } catch(e) {
    window.render = function() {
      return `<pre>${e.toString()}

${e.stack}</pre>`;
    }
  }
  // If the render function has been removed, then mount Vue
  if (typeof render!="function") {
    // Put the HTML contents back in case they are stale from previous render()
    update_html(current_html);
  }

  if (current_state) {
    update_state(current_state);
  }
}
function update_css(css) {
  let s = document.getElementById('css');
  if (!s) {
    s = document.createElement('style');
    s.id = "css";
    document.head.append(s);
  }
  s.textContent = css;
}
async function update_html(html) {
  current_html = html;
  if (VueApp) {
    unmount_vue();
  }
  document.body.innerHTML = html || "";
  if (current_state) {
    update_state(current_state);
  }
  await mount_vue();
}
function update_state(state) {
  current_state = state;
  if (typeof render === "function") {
    let html = render(state);
    if (typeof html === "string") {
      document.body.innerHTML = html;
    }
  }
  if ($VueData) {
    $VueData.state = state;
  }
}

// Listen for messages from the controlling window to update self
/*
Message data structure: (all fields optional)
{
  js: "code",
  css: "css",
  html: "html",
  state: Object
}
 */

addEventListener('message', async function(msg) {
  //console.log(`message received in canvas.js`,msg.data);
  if (!validateOrigin(msg)) {
    return;
  }
  //console.log("Message received in canvas", msg);
  try {
    let data = msg.data || {};
    for (let type in data) {
      if (!data.hasOwnProperty(type)) { continue; }
      let content = data[type];
      if (type === "html") {
        await update_html(content);
      }
      if (type === "js") {
        update_js(content);
      }
      if (type === "css") {
        update_css(content);
      }
      if (type === "state") {
        update_state(content);
      }
    }
  } catch (e) {
    // If anything isn't perfect, we abort
  }
});
