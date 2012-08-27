Graphiti = window.Graphiti || {};

Graphiti.startRefresh = function(seconds){
  Sammy.log('Starting refresh every ', seconds, ' seconds');
  this.refreshTimer = setInterval(function(){
    Sammy.log('Refreshing graph');
    $('#graphs-pane div.graph img.ggraph, #graph-preview img').attr('src', function(i, src) {
      Sammy.log($(this));
      src = src.replace(/(^.*_timestamp_=).*/, function (match, _1) {
        return  _1 +  new Date().getTime() + 1000 + "#.png";
      });
      return src;
    });
  }, seconds * 1000);
};

Graphiti.stopRefresh = function(){
  clearInterval(this.refreshTimer);
};

Graphiti.setRefresh = function(){
  if ($('#auto-refresh').prop('checked')) {
    this.startRefresh($("select[name='refresh_interval']").val());
  } else {
    this.stopRefresh();
  }
};

$(function() {
  Graphiti.setRefresh();
  $(".refresh input, .refresh select").change(function() {
    Graphiti.setRefresh();
  });
});
