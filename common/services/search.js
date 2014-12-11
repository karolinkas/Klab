angular.module('services.search', ['services.apiClient']);
angular.module('services.search').factory('Search', ['ApiClient', function(ApiClient) {
  var defaultQueryObject = {
    command: 'searchDocs',
    constraint: {},
    length: 30,
    query: '',
    start: 0
  };
  
  
  var search = {
    query: function(queryString) {
      var queryObject = angular.extend({}, defaultQueryObject, {query: queryString});
      return ApiClient.documents.GET.searchDocs(queryObject).then(function(result) {
        if (result.length === 1) {
          return result[0].document;
        } else {
          return [];
        }
      });
    }
  };
  return search;
}]);
