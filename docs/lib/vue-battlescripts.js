/*
A wrapper around Vue that is specific to BattleScripts
 */

// A global $vm to reference Vue data
let $vm = null;
let pendingVueData = {};
const isProd = (location && /https:\/\/(?:www\.)battlescripts.io\//.test(location.href));

if (typeof API!="undefined") {
  // Catch login/logout and update user in data
  API.onLogin(user=>{
    $vm.user = user;
  });
  API.onLogout(user=>{
    $vm.user = user;
  })
}

let setVueData = function(prop,val) {
  if ($vm) {
    $vm.data[prop] = val;
  }
  else {
    pendingVueData[prop]=val;
  }
};

// Create a Vue App
let createVueApp = async (data,App,mount,callback)=>{
  if (typeof App=="function") {
    callback=App;
    App=null;
  }
  else if (typeof mount=="function") {
    callback=mount;
    mount = null;
  }
  if (!App) { App={}; }
  if (!mount) { mount="#app"; }

  if (!data) {
    data = {};
  }

  // Add standard properties to the data
  data.user = null;
  data.userLoaded = false;
  data.loaded = false;
  data.data = {};
  data.data_url = isProd ? 'https://battlescripts.s3.amazonaws.com' : 'https://battlescripts-beta.s3.amazonaws.com';
  data.now = Date.now();

  App.data = function() {
    return data;
  };

  // Do things when the App is created
  App.created = function() {
    setInterval(()=> {
      let self = this;
      self.now = Date.now();
    }, 1000);
  };

  // Add global methods
  App.methods = Object.assign({
    ago:ago,
    longdate: d=>{
      return d?(new Date(d)).toString():"";
    },
    formatdate: d=>{
      if (typeof d!="number") return "";
      d = new Date(d);
      let options = {
        year:"numeric",
        month:"numeric",
        day:"numeric",
        weekday:"short",
        timeZoneName:"short"
      };
      // TODO
      return Intl.DateTimeFormat('default',options).format(d);
    },
    json: o=>{
      return JSON.stringify(o,null,2);
    }
  },App.methods);

  let app = await Vue.createApp(App);

  // COMPONENTS

  app.component('bs-user',{
    data() {
      return {
        expanded:false
      };
    },
    mounted() {
      if (typeof API!="undefined") {
        API.getUser().then(user => {
          //console.log(user);
          if (user) {
            this.$root.user = user
          }
          this.$root.userLoaded = true;
        },()=>{
          this.$root.userLoaded = true;
        });
      }
      addEventListener('click',()=>this.expanded=false);
    },
    methods: {
      toggle() {
        this.expanded = !this.expanded;
      },
      hide() {
        this.expanded = false;
      },
      show() {
        this.expanded = true;
      },
      login() {
        this.expanded = false;
        API.login()
      },
      logout() {
        this.expanded = false;
        API.logout()
      }
    },
    template: `
    <div @mouseenter.stop="show" @mouseleave.stop="hide" @click.stop="toggle" class="user-badge">
      <!-- Menu -->
      <div v-if="$root.userLoaded && $root.user && expanded" @click="hide" class="user-badge-menu">
        <div v-if="$root.user">
          <div>{{$root.user.name}}</div>
          <div class="user-badge-menu-item" @click.stop="logout">Logout</div>
          <a class="user-badge-menu-item" href="/me/index.html">My Players</a>
          <a class="user-badge-menu-item" href="/me/profile.html">Profile</a>
        </div>
      </div>
      <!-- Loading -->
      <div v-if="!$root.userLoaded">...</div>
      <!-- Logged In -->
      <div v-else-if="$root.user" class="user-badge-badge">
        <div class="user-badge-hamburger"><div></div><div></div><div></div></div>
        <img class="user-badge-picture" :src="$root.user.picture">
      </div>
      <!-- Not Logged In -->
      <div v-else class="user-badge-login" @click.stop="login">
        <div>Login</div>    
      </div>
    </div>
    `
  });
  app.component('hint',{
    props:['content','width','height','position'],
    mounted() {
      let el = this.$refs.hint;
      let d = el.querySelector('.hint-content');

      let w=250;
      let h=null;

      if (this.width) {
        w= +this.width;
      }
      d.style.width = w+"px";

      if (this.height) {
        h= +this.height;
        d.style.height = h+"px";
      }
      if (this.width && this.height) {
        d.style.overflow="auto";
      }
    },
    methods: {
      reposition: function() {
        let el = this.$refs.hint;
        let d = el.querySelector('.hint-content');
        let pos = this.position || "below";

        let w = d.offsetWidth;
        let h = d.offsetHeight;

        let hint_w = el.offsetWidth;
        let hint_h = el.offsetHeight;

        let l=0, t=0;

        if ("s"===pos || "below"===pos) {
          l = -(w / 2) + (hint_w / 2);
          t = hint_h + 3;
        }
        else if ("e"===pos || "right"===pos) {
          l = hint_h + 3;
          t = -(h / 2) + (hint_h / 2);
        }
        else if ("w"===pos || "left"===pos) {
          l = -(w + 3);
          t = -(h / 2) + (hint_h / 2);
        }
        else if ("n"===pos || "above"===pos) {
          l = -(w / 2) + (hint_w / 2);
          t = -h -3;
        }
        d.style.marginTop = t+"px";
        d.style.marginLeft = l+"px";
      }
    },
    template: `<span ref="hint" class="hint" @mouseenter="reposition"><div class="hint-content"><slot></slot></div></span>`
  });

  // DIRECTIVES

  app.directive('maxlength-counter', {
    mounted(el) {
      if (!el.maxLength) { return; }
      let c = document.createElement('span');
      c.className="maxlength-counter";
      el.addEventListener('keyup',function() {
        el.nextSibling.innerHTML=el.maxLength-el.value.length
      });
      el.after(c);
    },
    updated(el) {
      let v = el.maxLength;
      if (el.value) {
        v = v-el.value.length;
      }
      el.nextSibling.textContent = v;
    }
  });

  return new Promise((resolve)=>{
    $(async()=>{
      let mountElement = document.querySelector(mount);
      if (mountElement) {
        $vm = await app.mount(mount);

        // Merge attributes that might have been created before Vue loaded
        Object.assign($vm.data,pendingVueData);

        if (typeof callback=="function") {
          await callback();
        }
        $vm.loaded = true;
        resolve($vm);
      }
      else {
        console.log(`Vue mount point ${mount} not found in DOM`);
      }
    });
  });
};

// A global util method for relative times
let ago = function (when, now, shortened, higher_resolution) {
  if (!when || typeof when!="number") { return ""; }
  let m = 1000 * 60;
  let h = m * 60;
  let d = h * 24;
  let s= (t)=>{return t>1?"s":""; }

  now = now || Date.now();
  if (typeof shortened!="boolean") { shortened=true; }
  let diff = "";
  let delta = (now - when);
  let seconds = delta / 1000;
  if (seconds < 60) {
    return "just now";
  }
  let days = Math.floor(delta / d);
  if (days > 0) {
    diff += days+" day"+s(days)+" ";
    delta -= (days*d);
  }

  let hours = Math.floor(delta / h );
  if (hours>0 && (higher_resolution || !diff)) {
    diff += hours + " " + (shortened ? "hr" : "hour"+s(hours))+" ";
    delta -= (hours*h);
  }

  let minutes = Math.floor(delta / m);
  if (minutes>0 && (!diff || (higher_resolution && days<1))) {
    diff += minutes + " " + (shortened ? "min" : "minute"+s(minutes)) + " ";
  }
  if (!diff) {
    return "";
  }
  return diff+"ago";
};
