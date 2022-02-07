// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
function debounce(func, wait=1000, immediate) {
  var timeout;
  return function() {
    var context = this, args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

// Promisify fetches
const fetchJson = async(url)=>{
  let response = await fetch(url);
  return await response.json();
};

// URL Parameters
const params = new URLSearchParams(location.search.substring(1));

// Quick selectors
let domContentLoadedFired = false;
addEventListener('DOMContentLoaded',()=>domContentLoadedFired=true);
function $(selectorOrFunction) {
  if (typeof selectorOrFunction=="function") {
    if (domContentLoadedFired) {
      return selectorOrFunction();
    }
    return addEventListener('DOMContentLoaded',selectorOrFunction);
  }
  return document.querySelector(selectorOrFunction);
}
function $$(sel,f) {
  let all = document.querySelectorAll(sel);
  if (typeof f=="function") {
    if (all && all.length) {
      all.forEach(el=>f(el));
    }
  }
  return all;
}

// Display messages
((global)=>{
  let container = null;

  $(()=>{
    container = document.createElement('div');
    container.id="messages-container";
    document.body.appendChild(container);
  });
  /*
  options: {
    timeout (seconds): how long to wait before message auto-disappears
    shrinkDuration (seconds): how long it takes to shrink the message and disappear
    container (Element or selector): Where to attach the message to
    append: true to append the message to the container instead of prepend (default)
    replace: Remove all other messages when adding a new one
  }
   */
  global.Message = function(text,userOptions={}) {
    let options=Object.assign({
      timeout: 10,
      shrinkDuration: .3,
      container:container,
      dismissable:true,
      append:true,
      replace:false
    },userOptions);
    if (typeof options.container=="string") {
      options.container = document.querySelector(options.container);
    }

    let m = document.createElement('div');
    m.className=`messages-message ${options.className}`;
    m.innerHTML = `${text}`;
    m.title = "Click to close";
    m.style.transition=`height ${options.shrinkDuration}s linear`;

    if (options.dismissable) {
      let close = document.createElement('div');
      close.textContent = "X";
      close.className = "messages-close";
      m.appendChild(close);
    }

    let timer = null;
    if (options.timeout > 0) {
      timer = document.createElement('div');
      timer.className = 'messages-timer';
      timer.style.transition = `width ${options.timeout}s linear`;
      setTimeout(() => {
        timer.style.width = "0";
      }, 1);
      m.appendChild(timer);
    }

    let timeout_handle;
    if (options.dismissable) {
      m.addEventListener('click', () => {
        m.remove();
        m = null;
      });
    }
    m.addEventListener('mouseover',()=>{
      if (timeout_handle) {
        clearTimeout(timeout_handle);
      }
      if (timer) {
        timer.remove();
      }
    });

    if (options.timeout>0) {
      timeout_handle = setTimeout(() => {
        if (m) {
          m.style.height = "0px";
          m.style.overflow = "hidden";
          setTimeout(() => {
            m.remove();
          }, options.shrinkDuration * 1000);
        }
      }, options.timeout * 1000);
    }

    // Make sure we don't do this stuff before DOMContentLoaded
    $(()=>{
      // Remove existing messages
      if (options.replace) {
        options.container.querySelectorAll('.messages-message').forEach(e=>e.remove());
      }

      // Add the message
      if (options.append) {
        options.container.append(m);
      } else {
        options.container.prepend(m);
      }
      m.style.height = m.offsetHeight + "px";
    });
  };
  global.MessageError = function(text, options={}) {
    options.className = "messages-error";
    global.Message(text,options);
  };
  global.MessageClear = function(container) {
    if (typeof container=="string") {
      container = $(container);
    }
    container.querySelectorAll('.messages-message').forEach(e=>e.remove());
  }
})(this);

// Send Messages
function sendMessage(msg,target) {
  let allowed_domain = '*';
  if (target) {
    if (target.contentWindow) {
      target = target.contentWindow;
    }
    if (target.postMessage) {
      target.postMessage(msg,allowed_domain);
    }
    else {
      //console.log("target doesn't support postMessage");
      //console.log(target);
    }
    return;
  }
  if (parent && parent!==self) {
    parent.postMessage(msg,allowed_domain);
  }
  else if (opener) {
    opener.postMessage(msg,allowed_domain);
  }
  else {
    postMessage(msg,allowed_domain);
  }
}
function receiveMessage(type, callback) {
  addEventListener('message',(msg)=>{
    let data = msg.data;
    if (data && ("*"===type || type===data || (type===data.type))) {
      callback(data);
    }
  });
}
async function receiveMessageOnce(type) {
  return new Promise((resolve)=>{
    let listener = (msg)=>{
      let data = msg.data;
      if (data && ("*"===type || type===data || (type===data.type))) {
        resolve(data);
        removeEventListener('message',listener);
      }
    };
    addEventListener('message',listener);
  });
}

// VIEW ALL MESSAGES
// receiveMessage("*",data=>{
//   if (!/vscode/.test(JSON.stringify(data))) {
//     let str;
//     if (typeof data=="string") {
//       str = data;
//     }
//     else {
//       str = JSON.stringify(data);
//     }
//     if (str) {
//       Message(str, {timeout: 2});
//     }
//   }
// });

// Overlay Messages

function overlay(msg) {
  document.body.style.overflow="hidden";
  let o = $('#overlay');
  if (!o) {
    o = document.createElement('div');
    o.id = 'overlay';
    o.style.display="none";
    let mount = $('#app') || document.body;
    mount.appendChild(o);
  }
  if (typeof msg=="string") {
    o.innerHTML = msg;
  }
  else {
    o.innerHTML = "";
    o.appendChild(msg);
  }
  o.style.display="block";
}
function hide_overlay() {
  document.body.style.overflow="";
  let o = $('#overlay');
  if (o) {
    o.style.display = "none";
  }
}
function login_overlay(to_what) {
  overlay(`<span class="button" onclick="API.login();" style="display:inline;">Login</span> required ${to_what}`);
}

// Eval module code
function getCode(js) {
  let code = `((()=>{ let module={exports:null}; ${js}; return module.exports;})());`;
  code = eval(code);
  return code;
}
// Put code into an async Worker to isolate it
function getWorkerPlayerFromCode(js) {
  let code = `
    let player = (()=>{ 
      let module={exports:null}; 
      ${js}; 
      return module.exports;
    })();
    // Listen for calls to methods and call back with response
    self.onmessage = function(msg) {
      let method = msg.data.method;
      let json = msg.data.json;
      let source = msg.source;
      if (typeof player[method]=="function") {
        self.postMessage(player[method](json));
      }
      else {
        self.postMessage(null);
      }
    };
`;

  let compilationError = null;

  let blob = new Blob([code], {type: 'application/javascript'});
  let worker = new Worker(URL.createObjectURL(blob));
  let compilationErrorHandler = function(e) {
    e.preventDefault();
    compilationError = e;
  };

  // Add an error listener in case of compilation errors,
  // then remove it when the first successful message is received
  worker.addEventListener('error',compilationErrorHandler);

  let workerMessage = (msg)=>{
    return new Promise((resolve,reject)=>{
      // If there was a compilation error, don't even talk to the player
      if (compilationError) {
        return reject(compilationError);
      }

      //worker.removeEventListener('error',compilationErrorHandler);
      if (worker && worker.postMessage) {
        let successHhandler = (msg)=>{
          worker.removeEventListener('message',successHhandler);
          worker.removeEventListener('error', errorHandler);
          resolve(msg.data);
        };
        let errorHandler = (e)=>{
          worker.removeEventListener('message',successHhandler);
          worker.removeEventListener('error', errorHandler);
          reject(e);
        };
        // Listen for the response
        worker.addEventListener('message',successHhandler);
        worker.addEventListener("error", errorHandler);

        worker.postMessage(msg);
      }
    });
  };
  let terminateWorker = ()=>{
    if (worker && worker.terminate) {
      worker.terminate();
    }
    blob = null;
    worker = null;
  };
  // Return an actual sync js player which passes message to the Worker
  return {
    onGameStart:(json)=>workerMessage({"method":"onGameStart","json":json}),
    onTurn:(json)=>workerMessage({"method":"onTurn","json":json}),
    onGameEnd:(json)=>workerMessage({"method":"onGameEnd","json":json}),
    terminate: terminateWorker
  };
}

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}
