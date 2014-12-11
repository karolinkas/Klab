angular.module('home', ['services.search', 'directives.searchResultList']);
angular.module('home').config(['$stateProvider', function($stateProvider) {
  $stateProvider.state('home', {
    url: '/',
    templateUrl: 'app/home/home.html',
    controller: 'HomeController'
  });
}]);

angular.module('home').controller('HomeController', ['$scope', 'Search', function($scope, Search) {
  $scope.Search.query();
}]);
