// Global refs to Monaco editors, keyed by containing element id
let editors = {};

async function editor(mount,code,language,mode,config) {
  let defaultConfig = {
    value: code,
    language: (language||'javascript'),
    theme: "vs-dark",
    scrollBeyondLastLine: false,
    scrollbar: {
      verticalHasArrows: true,
      horizontalHasArrows: true,
      vertical: 'visible',
    },
    minimap: {
      enabled: false
    }
  };

  let simpleMode = {
    // Turn off the left gutter
    lineNumbers: 'off',
    glyphMargin: false,
    folding: false,
    lineDecorationsWidth: 0,
    lineNumbersMinChars: 0,
    minimap: {
      enabled:false
    }
  };

  if ("simple"===mode) {
    Object.assign(defaultConfig,simpleMode);
  }

  if (config) {
    Object.assign(defaultConfig,config);
  }

  return monaco.editor.create(mount, defaultConfig);
}

function on_editor_change(id,cb,delay=1000) {
  editors[id].onDidChangeModelContent(debounce(function(e) {
    cb(editors[id].getValue());
  },delay));
}

function get_editor_value(id) {
  if (editors[id]) {
    return editors[id].getValue();
  }
  return null;
}

function set_editor_value(id, value) {
  if (editors[id]) {
    if (typeof value=="undefined" || value===null) {
      value = "";
    }
    else if (typeof value!="string") {
      value = JSON.stringify(value, null, 2)
    }
    editors[id].setValue(value);
    editors[id].layout();
    return true;
  }
  return false;
}

async function init_monaco() {
  return new Promise((resolve)=> {
    require.config({paths: {'vs': '../monaco/min/vs'}});
    require(['vs/editor/editor.main'], async function () {
      // validation settings
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: false
      });

      // compiler options
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES6,
        allowNonTsExtensions: true
      });

      // load editors
      let editorDivs = document.querySelectorAll('.monaco-editor');
      for (let i = 0; i < editorDivs.length; i++) {
        let div = editorDivs[i];
        let model = div.getAttribute('model');
        let attr = div.getAttribute('attribute');
        let index = div.getAttribute('index');
        let language = div.getAttribute('language') || 'javascript';
        let mode = div.getAttribute('editor-mode');
        let config = div.getAttribute('editor-config');
        let code = "";
        if (model && attr && $vm && typeof $vm[model]!="undefined" && typeof $vm[model][attr]!="undefined") {
          code = $vm[model][attr];
          if (index) {
            code = code[index];
          }
        }
        else if (model && $vm && typeof $vm[model]!="undefined") {
          code = $vm[model];
        }
        if (config) {
          try {
            config = JSON.parse(config);
          }
          catch (e) {
            console.log(e);
            console.log(config);
            config = null;
          }
        }
        else {
          config = null;
        }
        let e = await editor(div, code, language, mode, config);
        // Watch for changes to editor and put the content back into the model
        if (model) {
          e.onDidChangeModelContent(debounce(function() {
            let val = e.getValue();
            if (index) {
              $vm[model][attr][index]=val;
            }
            else if (attr) {
              $vm[model][attr]=val;
            }
            else {
              $vm[model]=val;
            }
          },300));
        }
        let id = div.getAttribute('id');
        if (id) {
          editors[id] = e;
        }
        else {
          console.log("No id attribute set on monaco editor",div);
        }

        // Watch for resize of the containing div and layout again
        // if (typeof ResizeObserver!="undefined") {
        //   const resizeObserver = new ResizeObserver(() => {
        //     e.layout();
        //   });
        //   resizeObserver.observe(div);
        // }

        e.layout();
      }

      resolve();

    });
  });
}

// TODO: Handle this better!!!
// This is a nasty hack that resizes all editors after Vue has updated its UI
// Monaco doesn't size itself correctly if the container isn't initially visible or on resize
function resize_editors() {
  let f = () => {
    Object.values(editors).forEach(e => {
      e.layout();
    });
  };
  if (Vue) {
    Vue.nextTick(f);
  }
  else {
    f();
  }
}
addEventListener('resize',resize_editors);
