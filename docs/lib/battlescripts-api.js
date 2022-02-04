// BATTLESCRIPTS API
const API = (function() {
  const isProd = (location && /https:\/\/(?:www\.)battlescripts.io\//.test(location.href));
  // Switch locations based on prod or other
  const api_root = isProd ? 'https://api.battlescripts.io' : 'https://api-beta.battlescripts.io';
  const data_root = isProd ? '' : 'https://beta-assets.battlescripts.io';

  let debug = function() {
    if (api.debug) {
      let args = Array.from(arguments);
      args.unshift("[API Debug]");
      console.log.apply(null,args);
    }
  };

  let auth_window = null;

  let auth0 = null;
  let auth0JWT = null;
  let user = null;
  let token = null;

  let extractAuth0Jwt = async ()=>{
    debug("Extracting Auth0 JWT");
    auth0JWT = null;
    let auth0user = await auth0.getIdTokenClaims();
    if (auth0user && auth0user.__raw) {
      auth0JWT = auth0user.__raw;
      debug("jwt", auth0JWT);
    }
    return auth0JWT;
  };

  // Listen for a call from the login window to update auth

  let loginHandlers=[];
  let logoutHandlers=[];
  addEventListener('message', async (msg)=>{
    if (msg && msg.data) {
      if (msg.data==="LOGIN") {
        // Force a re-fetch of auth
        api.unauth();
        await API.auth();
        loginHandlers.forEach(f => f(user));
      }
      else if (msg.data==="LOGOUT") {
        // Force a re-fetch of auth
        api.unauth();
        logoutHandlers.forEach(f => f(null));
      }
    }
  });

  let authPromise = null;
  let clientPromise = null;
  let createClient = async()=>{
    debug("Creating Client");
    if (!clientPromise) {
      debug("Client promise doesn't exist");
      clientPromise = new Promise(async (resolve) => {
        // Configure Client
        const config = {
          "domain": "battlescripts.us.auth0.com",
          "clientId": "VHEh7SSjs6enOFXVISF1voKgl6zyBm3t"
        };
        auth0 = await createAuth0Client({
          domain: config.domain,
          client_id: config.clientId,
          scope: 'openid profile picture',
          redirect_uri: window.location.origin + "/login.html"
        });
        await auth0.checkSession();
        resolve();
      });
    }
    else {
      debug("Client promise already exists, returning it");
    }
    return clientPromise;
  };

  let parseJwt =function(token) {
    try {
      let base64Url = token.split('.')[1];
      let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      let jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch(e) {
      return null;
    }
  };

  let getUserFromStorage = function() {
    debug("Checking sessionStorage for user");
    let sessionUser = sessionStorage.getItem('user');
    if (sessionUser) {
      debug("Auth found in sessionStorage", sessionUser);
      try {
        sessionUser = JSON.parse(sessionUser);
        token = sessionUser.token;

        // Extract token from jwt string
        let decodedToken = parseJwt(token);

        if (decodedToken && decodedToken.exp<Date.now()) {
          user = sessionUser.user;
          debug("Found user", user);
          return user;
        }
        else {
          debug("Session token expired",decodedToken.exp,Date.now());
          sessionStorage.removeItem('user');
        }
      } catch (e) {
        console.log(e);
      }
    }
    return null;
  };

  let getCurrentAuth0Session = async function() {
    await createClient();
    let isAuthenticated = await auth0.isAuthenticated();
    // Check to see if we are already authenticated
    debug("isAuthenticated",isAuthenticated);
    if (!isAuthenticated) {
      return null;
    }
    await extractAuth0Jwt();
    if (!auth0JWT) {
      return null;
    }
    return auth0JWT;
  };

  let api = {
    debug:false,
    getDataPath: (path="")=>{
      return data_root + path;
    },
    getGameImage: (id,size=300)=>{
      return `${data_root}/images/${id}-${size}.png`;
    },
    getUser: async () => {
      await api.auth();
      return user;
    },
    unauth: ()=>{
      clientPromise = null;
      authPromise = null;
      auth0 = null;
      user = null;
      token = null;
      auth0JWT = null;
      sessionStorage.removeItem('user');
    },

    // Retrieve auth information, either from storage or from Auth0
    getCurrentAuth0Session: getCurrentAuth0Session,
    auth: async (forceRemoteAuth=false) => {
      debug("auth()");
      if (authPromise && !forceRemoteAuth) {
        debug("Returning auth Promise");
        return authPromise;
      }

      authPromise = new Promise(async(resolve)=>{
        // Try to get user and API token from sessionStorage
        if (!forceRemoteAuth) {
          getUserFromStorage();
          if (user) {
            debug("Resolving auth promise to user found in storage");
            return resolve(user);
          }
        }

        // If we get here, we need to check with Auth0
        try {
          await getCurrentAuth0Session();
          // If we have an Auth0 jwt, we can call the BattleScripts user service to get our real user record and token
          if (auth0JWT) {
            let battlescriptsUser = await api.getBattlescriptsUser();
            if (!battlescriptsUser || !battlescriptsUser.token) {
              debug("Resolving auth promise to false because getBattleScriptsUser returned no user");
              return resolve(false);
            }
            // We have exchanged an auth0 token for a BS token, so store it for future use
            token = battlescriptsUser.token;
            user = battlescriptsUser.user;
            sessionStorage.setItem('user', JSON.stringify(battlescriptsUser));
            debug("Resolving auth promise to user");
            return resolve(user);
          }

        } catch (e) {
          console.log(e);
        }
        debug("Resolving auth promise to false because we got to the end");
        resolve(false);
      });
      return authPromise;
    },
    loginWithRedirect: async ()=>{
      await auth0.loginWithRedirect({
        redirect_uri: window.location.origin + "/login.html"
      });
    },
    logoutWithRedirect: async ()=>{
      let returnTo = window.location.origin + "/logout.html";
      auth0.logout({
        returnTo: returnTo
      });
    },

    handleAuthRedirect: async ()=>{
      const query = window.location.search;
      if (query.includes("code=") && query.includes("state=")) {
        await createClient();
        await auth0.handleRedirectCallback();
        let isAuthenticated = await auth0.isAuthenticated();
        extractAuth0Jwt();
        return isAuthenticated;
      }
      return false;
    },

    login: function() {
      auth_window = window.open('/login.html','battlescripts-login','width=600,height=800,toolbar=no,location=no,status=no,menubar=no');
    },
    logout: function() {
      auth_window = window.open('/logout.html','battlescripts-logout','width=600,height=800,toolbar=no,location=no,status=no,menubar=no');
    },
    onLogin: function(f) {
      loginHandlers.push(f);
    },
    onLogout: function(f) {
      logoutHandlers.push(f);
    },

    fetchAPI: async function(endpoint,requiresAuth,config) {
      return api.fetch(api_root+endpoint,requiresAuth,config);
    },
    fetchData: async function(path,config) {
      return api.fetch(data_root+path,false,config);
    },
    fetch: async function(endpoint,requiresAuth=true,config) {
      config = Object.assign({},config);
      if (!config.headers) {
        config.headers = {};
      }

      if (requiresAuth) {
        let u = await api.auth();
        if (!(u)) {
          throw "Not Authenticated";
        }
      }
      if (requiresAuth) {
        if (!config.headers['Authorization']) {
          config.headers['Authorization'] = "Bearer " + token;
        }
      }
      let response = await fetch(endpoint,config);
      let jsonResponse = null;

      if (500===response.status) {
        try {
          jsonResponse = await response.json();
          if (jsonResponse && jsonResponse.error) {
            if ("TokenExpiredError" === jsonResponse.error.name) {
              debug("Token has expired");
              if (sendMessage) {
                sendMessage("LOGOUT");
              }
              else {
                api.unauth();
              }
              if (MessageError) {
                MessageError("Your session has expired. Please login again.");
                throw "Token Expired";
              }
              else {
                throw "Token Expired";
              }
            }
            throw jsonResponse.error.message || jsonResponse.error;
          }
          throw "500 Error";
        } catch(e) {
          console.log(e);
          throw e;
        }
      }
      if (401===response.status) {
        throw "Not Authenticated";
      }
      let content;
      let responseHeaders = response.headers;
      let error = null;
      if (!responseHeaders || "application/json"===responseHeaders.get('content-type')) {
        content = await response.json();
        if (content && content.error) {
          error = content.error;
        }
      }
      else {
        content = await response.text();
      }
      if (!response.ok) {
        throw error || content;
      }
      return content;
    },

    /*
     * GAME
     */
    getPublishedGame: async function(id) {
      let game = await api.fetchData(`/game/${id}.json`,false);
      if (!game || typeof game.id=="undefined") {
        return null;
      }
      return game;
    },
    getGame: async function(id) {
      let game = await api.fetchAPI(`/game/${id}`);
      if (!game || typeof game.id=="undefined") {
        return null;
      }
      return game;
    },
    getGameTemplate: async function() {
      return await api.fetchAPI(`/game/template`,false);
    },
    saveGame: async function(game) {
      if (!game) { throw "No game to save"; }
      let id = game.id;
      let method = 'POST';
      let path = `/game`;
      if (id!==null && typeof id!=="undefined" && id!=="") { //update
        method = 'PATCH';
        path = `/game/${id}`;
      }

      game.min_players = +game.min_players;
      game.max_players = +game.max_players;
      game.difficulty = +game.difficulty || 3;
      return await api.fetchAPI(path, true, {
        method:method,
        mode:'cors',
        body:JSON.stringify(game)
      });
    },
    publishGame: async function(id) {
      if (!id) { throw "No game id "; }
      let path = `/game/${id}/publish`;
      return await api.fetchAPI(path, true, {
        method:'post',
        mode:'cors'
      });
    },
    listGames: async function() {
      return await api.fetchData("/game/index.json");
    },

    /*
     * PLAYER
     */
    getPlayer: async function(id) {
      let player = await api.fetchAPI(`/player/${id}`);
      if (!player || typeof player.id=="undefined") {
        return null;
      }
      return player;
    },
    savePlayer: async function(player) {
      if (!player) { throw "No player to save"; }
      let id = player.id;
      let method = 'POST';
      let path = `/player`;
      if (id!==null && typeof id!=="undefined" && id!=="") { //update
        method = 'PATCH';
        path = `/player/${id}`;
      }

      return await api.fetchAPI(path, true, {
        method:method,
        mode:'cors',
        body:JSON.stringify(player)
      });
    },
    publishPlayer: async function(id) {
      if (!id) { throw "No player id "; }
      let path = `/player/${id}/publish`;
      return await api.fetchAPI(path, true, {
        method:'post',
        mode:'cors'
      });
    },
    deletePlayer: async function(id) {
      if (!id) { throw "No player id "; }
      let path = `/player/${id}`;
      return await api.fetchAPI(path, true, {
        method:'delete',
        mode:'cors'
      });
    },
    unpublishPlayer: async function(id) {
      if (!id) { throw "No player id "; }
      let path = `/player/${id}/publish`;
      return await api.fetchAPI(path, true, {
        method:'delete',
        mode:'cors'
      });
    },

    /*
     * USER
     */
    myPlayers: async function() {
      let path = `/me/players`;
      return await api.fetchAPI(path);
    },
    getBattlescriptsUser: async function() {
      return await api.fetchAPI('/me',false,{"headers":{Authorization: "Bearer " + auth0JWT}});
    },
    saveUserProfile: async function(user){
      //TODO
      console.log("Saving in api");
      console.log(user);
    }
  };

  return api;
})();
