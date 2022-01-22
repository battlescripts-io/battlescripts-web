// Global ref to the Vue ViewModel instance
let $vm = null;
// Pre-define data attributes so Vue can detect changes
let data = {
  loaded: false
};

// VUE

async function init_vue(mount) {
  const App = {
    data() {
      return data;
    },
    created() {},
    mounted() {},
    methods: {

    }
  };
  let app = await Vue.createApp(App);
  $vm = await app.mount(mount);
}

// INIT

addEventListener('DOMContentLoaded',async ()=>{
  overlay("Loading...");

  await init_vue('#app');
  //await init_monaco();
  $vm.loaded = true;

  // Attach resizers
  document.querySelectorAll('.resizer').forEach(function(ele) {
    resizable(ele, function(state) {
      if ("start"===state) {
        $$('.editors > *',el=>{el.style.width=0;el.style.visibility='hidden';});
      }
      else {
        $$('.editors > *',el=>{el.style.visibility='';});
        resize_editors();
      }
    });
  });

  hide_overlay();
});

// Receive messages from the display iframe
addEventListener('message', function(msg) {

});


