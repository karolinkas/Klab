angular.module('services.apiClient', []);
angular.module('services.apiClient').factory('ApiClient', ['$q', 'ENV_CONFIG', function($q, ENV_CONFIG) {
  var createAsyncApiCall = function(q, func) {
    return function() {
      var deferred = q.defer();

      [].push.call(arguments, function(errors, results) {
        if (errors !== null && errors.length > 0) {
          deferred.reject(errors);
        } else {
          if (results.data.length === 0) {
            deferred.resolve(void 0);
          } else {
            deferred.resolve(results.data);
          }
        }
      });

      func.apply(this, arguments);

      return deferred.promise;
    };
  };
  
  
  var mujsClient = mujs.createApiClient(ENV_CONFIG.apiClient);
  
  
  var supportedMethods = {
    DELETE: true,
    GET: true,
    POST: true,
    PUT: true,
    WIPE: true
  };
  var supportedResources = {};
  for (var res in mujs.resources) {
    if (res !== 'BaseResource') {
      supportedResources[res.charAt(0).toLowerCase() + res.slice(1)] = true;
    }
  }
  
  
  // create a promise interface for mujs client library
  var service = {};
  var storeAsyncApiCall = function(resource, method, specifier) {
    service[resource][method][specifier] = createAsyncApiCall($q, function(data, callback) {
      mujsClient[resource][method][specifier](data, callback);
    });
  };
  
  for (var resource in mujsClient) {
    if (typeof supportedResources[resource] !== 'undefined' && supportedResources[resource]) {
      if (typeof service[resource] === 'undefined') {
        service[resource] = {};
      }
      for (var method in mujsClient[resource]) {
        if (typeof supportedMethods[method] !== 'undefined' && supportedMethods[method]) {
          if (typeof service[resource][method] === 'undefined') {
            service[resource][method] = {};
          }
          for (var specifier in mujsClient[resource][method]) {
            storeAsyncApiCall(resource, method, specifier);
          }
        }
      }
    }
  }
  
  
  // create a helper function for login
  var asyncLogin = createAsyncApiCall($q, function(credentials, callback) {
    mujsClient.users.login(credentials.username, credentials.password, true, callback);
  });
  service.login = function(credentials) {
    return asyncLogin(credentials).then(function(tokenData) {
      return service.users.GET.byOauthToken({oauthToken: tokenData[0].access_token});
    });
  };
  
  // create a helper function for logout
  service.logout = createAsyncApiCall($q, function(userId, callback) {
    mujsClient.users.logout(userId, callback);
  });
  
  // create a helper function to get the current user
  var asyncGetTokenData = function() {
    var deferred = $q.defer();
    
    mujsClient.getTokenData(function(errors, results) {
      if ((errors !== null && errors.length > 0) || results === null) {
        deferred.reject(errors);
      } else {
        deferred.resolve(results);
      }
    });
    
    return deferred.promise;
  };
  service.getCurrentUser = function() {
    return asyncGetTokenData().then(function(tokenData) {
      return service.users.GET.byOauthToken({oauthToken: tokenData.access_token});
    });
  };
  
  
  return service;
}]);
