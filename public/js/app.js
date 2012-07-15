var app = Sammy('body', function() {
  this.use('Session');
  this.use('NestedParams');

  var canon = require("pilot/canon");

  var intervals = [
    ['-3h', '3 Hours'],
    ['-12h', '12 Hours'],
    ['-2d', '2 Days'],
    ['-7d', '1 Week'],
    ['-30d', '1 month']
  ];

  this.registerShortcut = function(name, keys, callback) {
    var app = this;
    app.bind(name, callback);
    canon.addCommand({
       name: name,
       bindKey: {
         win: "Ctrl-" + keys,
         mac: "Command-" + keys,
         sender: 'editor'
       },
       exec: function() {
         app.trigger(name);
       }
    });

    key('command+' + keys, function() {
      app.trigger(name);
      return false;
    });
  };

  this.helpers({
    showPane: function(pane, content) {
      var selector = '#' + pane + '-pane';
      $('.pane:not(' + selector + ')').hide();
      var $pane = $(selector);
      if (content) { $pane.html(content); }
      return $pane.show();
    },
    setupEditor: function() {
      if (this.app.editor) return;

      var ctx = this;
      var editor = this.app.editor = ace.edit("editor");
      editor.setTheme("ace/theme/textmate");
      var JSONMode = require("ace/mode/json").Mode;
      var session = editor.getSession();
      session.setMode(new JSONMode());
      session.setUseSoftTabs(true);
      session.setTabSize(2);
    },
    redrawPreview: function() {
      try {
        this.log('redraw');
        this.graphPreview(this.getEditorJSON());
      } catch(e) {
        alert(e);
      }
      return false;
    },
    showEditor: function(text, uuid) {
      this.showPane('editor');
      $('#view-controls').show();
      if (!text) {
        text = defaultGraph;
      }
      this.setupEditor();
      var text = this.setEditorJSON(text);
      $('#editor').show();
      this.graphPreview(JSON.parse(text));
      this.buildDashboardsDropdown(uuid);
      if (uuid) { // this is an already saved graph
        $('#graph-actions form, #view-controls form').attr('data-action', function(i, action) {
          if (action) {
            $(this).attr('action', action.replace(/:uuid/, uuid));
          }
        }).show();
        $('[name=uuid]').val(uuid);
        $('#graph-actions').find('.update, .dashboard').show();
        this.toggleUpdateAvailability(false);
      } else {
        $('#graph-actions').find('.update, .dashboard').hide();
      }
      this.toggleEditorPanesByPreference();
    },
    toggleUpdateAvailability: function(unsaved) {
      if (unsaved) {
        $('#graph-actions').find('.update input').removeAttr('disabled');
      } else {
        $('#graph-actions').find('.update input').attr('disabled', 'disabled');
      }
    },
    getEditorJSON: function() {
      return JSON.parse(this.app.editor.getSession().getValue());
    },
    setEditorJSON: function(text) {
      if (typeof text != 'string') {
        text = JSON.stringify(text, null, 2);
      }
      this.app.editor.getSession().setValue(text);
      return text;
    },
    graphPreview: function(options) {
      // get width/height from img
      this.session('lastPreview', options, function() {
        var $img = $("#graph-preview img"), $url = $('#graph-url input');
        var graph = new Graphiti.Graph(options);
        graph.image($img);
        $url.val(graph.buildURL());
      });
      this.updateOptionsForm(options);
    },
    updateOptionsForm: function(options) {
      var opts = options.options ? options.options : options,
          key, $form = $('#graph-options form');
      for (key in opts) {
        if (opts[key] != '') {
          $form.find('[name="options[' + key + ']"]').val(opts[key]);
        }
      }
    },
    saveOptions: function(params) {
      var json = this.getEditorJSON();
      json.options = params;
      this.toggleUpdateAvailability(true);
      this.graphPreview(json);
      this.setEditorJSON(json);
    },
    setOptions: function(options) {
      var json = this.getEditorJSON();
      $.extend(json.options, options);
      this.graphPreview(json);
      this.setEditorJSON(json);
    },
    buildMetricsList: function($list, metrics) {
      var $li = $list.find('li:first').clone();
      $list.html('');
      var i = 0, l = metrics.length;
      for (; i < l; i++) {
        Sammy.log(metrics[i]);
        $li.clone()
        .attr('id', "metric_list_metric_" + i)
        .find('strong').text(metrics[i])
        .end()
        .appendTo($list).show();
      }
    },
    bindMetricsList: function() {
      var ctx = this;
      var $list = $('#metrics-list ul')
      var throttle;
      $('#metrics-menu')
        .find('input[type="search"]').live('keyup', function() {
          var val = $(this).val();
          if (throttle) {
            clearTimeout(throttle);
          }
          throttle = setTimeout(function() {
            ctx.searchMetricsList(val);
          }, 200);
        });
      $list.delegate('li a', 'click', function(e) {
        e.preventDefault();
        var action = $(this).attr('rel'),
            metric = $(this).siblings('strong').text();
        Sammy.log('clicked', action, metric);
        ctx[action + "GraphMetric"](metric);
      }).addClass('.bound');
    },

    searchMetricsList: function(search) {
      var ctx = this;
      var $list = $('#metrics-list ul');
      var $loading = $('#metrics-list .loading');
      var $empty = $('#metrics-list .empty');
      var url = '/metrics.js';
      url += '?q=' + search;
      if (ctx.app.searching) return;
      if (search.length > 4) {
        ctx.app.searching = true;
        $empty.hide();
        $loading.show();
        return this.load(url).then(function(metrics) {
          var metrics = metrics.metrics;
          $loading.hide();
          if (metrics.length > 0) {
            $list.show();
            ctx.buildMetricsList($list, metrics);
          } else {
            $empty.show();
          }
          ctx.app.searching = false;
        });
      } else {
        $empty.show();
        $list.hide();
      }
    },
    addGraphMetric: function(metric) {
      var json = this.getEditorJSON();
      json.targets.push([metric, {}]);
      this.graphPreview(json);
      this.setEditorJSON(json);
    },
    replaceGraphMetric: function(metric) {
      var json = this.getEditorJSON();
      json.targets = [[metric, {}]];
      this.graphPreview(json);
      this.setEditorJSON(json);
    },
    timestamp: function(time) {
      if (typeof time == 'string') {
        time = parseInt(time, 10);
      }
      return new Date(time * 1000).toString();
    },
    buildDashboardsDropdown: function(uuid) {
      this.load('/dashboards.js', {cache: false, data: {uuid: uuid}})
          .then(function(data) {
            var $select = $('select[name="dashboard"]');
            $select.html('');
            var dashboards = data.dashboards,
                i = 0,
                l = dashboards.length,
                dashboard;
            for (; i < l; i++) {
              dashboard = dashboards[i];
              $('<option />', {
                value: dashboard.slug,
                text: dashboard.title
              }).appendTo($select);
            }
          });
    },
    buildSnapshotsDropdown: function(urls, clear) {
      var $snapshot_controls = $('li.snapshots form.select');
      var $select = $snapshot_controls.find('select');
      if (clear) { $select.html(''); }
      var i = 0,
          l = urls.length, url, date;
      if (l < 1) {
        $snapshot_controls.hide();
        return;
      }
      for (; i < l; i++) {
        url = urls[i];
        date = this.snapshotURLToDate(url);
        $('<option />', {
          value: url,
          text: date
        }).prependTo($select).attr('selected', 'selected')
      }
      $snapshot_controls.show();
    },
    loadAndRenderGraphs: function(url) {
      var ctx = this;

      $('#view-controls').show();

      this.load(url, {cache: false})
          .then('renderGraphs');
    },
    renderGraphs: function(data) {
      var $graphs = this.showPane('graphs', ' ');
      var title = 'All Graphs', is_dashboard;
      if (data.title) {
        is_dashboard = true;
        title = data.title;
      } else {
        is_dashboard = false;
      }
      $graphs.append('<h2>' + title + '</h2>');
      var graphs = data.graphs,
          i = 0,
          l = graphs.length,
          $graph = $('#templates .graph').clone(),
          graph, graph_obj;
      if (data.graphs.length == 0) {
        $graphs.append($('#graphs-empty'));
        return true;
      }
      for (; i < l; i++) {
        graph = graphs[i];
        graph_obj = new Graphiti.Graph(graph.json);

        $graph
        .clone()
        .find('.title').text(graph.title || 'Untitled').end()
        .find('a.edit').attr('href', '/graphs/' + graph.uuid).end()
        .show()
        .appendTo($graphs).each(function() {
          // actually replace the graph image
          graph_obj.image($(this).find('img'));
          // add a last class alternatingly to fix the display grid
          if ((i+1)%2 == 0) {
            $(this).addClass('last');
          }
          // if its all graphs, delete operates on everything
          if (!is_dashboard) {
            $(this)
            .find('.delete')
            .attr('action', '/graphs/' + graph.uuid);
          // otherwise it just removes the graphs
          } else {
            $(this)
            .find('.delete')
            .attr('action', '/graphs/dashboards')
            .find('[name=dashboard]').val(data.slug).end()
            .find('[name=uuid]').val(graph.uuid).end()
            .find('[type=submit]').val('Remove');
          }
        });
      }
    },
    buildIntervalsGraphs: function(graph) {
      $('#view-controls').show();
      var i = 0, l = intervals.length, graphs = [], json;
      graph.json = JSON.parse(graph.json);
      for (; i < l; i++) {
        var new_graph = $.extend(true, {}, graph);
        new_graph.json.options['from'] = intervals[i][0];
        new_graph.title = new_graph.json.options['title'] = graph.json.options.title + ", " + intervals[i][1];
        graphs.push(new_graph);
      }
      this.renderGraphs({title: graph.title + ": All Intervals", graphs: graphs});
    },
    loadAndRenderDashboards: function() {
      var $dashboards = this.showPane('dashboards', '<h2>Dashboards</h2>');
      var ctx = this;

      $('#view-controls').hide();

      this.load('/dashboards.js', {cache: false})
          .then(function(data) {
            var dashboards = data.dashboards,
            i = 0, l = dashboards.length, dashboard, alt,
            $dashboard = $('#templates .dashboard').clone();

            if (dashboards.length == 0) {
              $dashboards.append($('#dashboards-empty'));
            } else {
              for (; i < l;i++) {
                dashboard = dashboards[i];
                alt = ((i+1)%2 == 0) ? 'alt' : '';
                $dashboard.clone()
                  .find('a.view').attr('href', '/dashboards/' + dashboard.slug).end()
                  .find('.title').text(dashboard.title).end()
                  .find('.graphs-count').text(dashboard.graphs.length).end()
                  .find('.updated-at').text(ctx.timestamp(dashboard.updated_at)).end()
                  .find('form.delete').attr('action','/dashboards/'+dashboard.slug).end()
                  .addClass(alt)
                  .show()
                  .appendTo($dashboards);
              }
            }

          });
    },

    loadAndRenderSnapshots: function() {
      var ctx = this;
      $('#view-controls').hide();
      this.load('/graphs/' + this.params.uuid + '.js', {cache: false})
          .then(function(graph_data) {
            var $snapshots = ctx.showPane('snapshots', '<h2>' + graph_data.title + ' - Snapshots</h2>');
            var snapshots = graph_data.snapshots,
            i = 0, l = snapshots.length, snapshot,
            $snapshot = $('#templates .snapshot').clone();
            for (; i < l; i++) {
              snapshot = snapshots[i];
              $snapshot.clone()
              .find('a.view').attr('href', snapshot).end()
              .find('img').attr('src', snapshot).end()
              .find('h3.title').text(ctx.snapshotURLToDate(snapshot)).end()
              .show()
              .appendTo($snapshots);
            }
          });
    },

    snapshotURLToDate: function(url) {
      var date;
      try {
        date = new Date(parseInt(url.match(/\/(\d+)\.png/)[1], 10)).toString();
      } catch (e) { }
      return date;
    },

    bindEditorPanes: function() {
      var ctx = this;
      $('#editor-pane')
      .delegate('.edit-group .edit-head', 'click', function(e) {
        e.preventDefault();
        var $group = $(this).add($(this).siblings('.edit-body'))
        var group_name = $group.parents('.edit-group').attr('data-group');
        if ($group.is('.closed')) {
          $group.removeClass('closed').addClass('open');
          ctx.session('groups:' + group_name, true);
        } else {
          $group.addClass('closed').removeClass('open');
          ctx.session('groups:' + group_name, false);
        }
      });
    },

    bindIntervalToggling: function() {
      var ctx = this;
      $('.variable-interval-toggle').change(function() {
        $(this).parents('form').submit();
        $('.variable-interval-fixed').toggle();
      });
      $('.graph-intervals select').change(function() {
        ctx.trigger('change-interval', {interval: $(this).val()});
      });
    },

    toggleEditorPanesByPreference: function() {
      var ctx = this;
      $('#editor-pane .edit-group').each(function() {
        var $group = $(this), group_name = $group.attr('data-group'),
            $parts = $group.find('.edit-head, .edit-body');
        ctx.session('groups:' + group_name, function(open) {
          if (open) {
            $parts.removeClass('closed').addClass('open');
          } else {
            $parts.removeClass('open').addClass('closed');
          }
        });
      });
    },

    confirmDelete: function(type) {
      var warning = "Are you sure you want to delete this " + type + "? There is no undo. You may regret this later.";
      return confirm(warning);
    },

    showSaving: function(title) {
      this.$button = $(this.target).find('input');
      this.original_button_val = this.$button.val();
      this.$button.val('Saving').attr('disabled', 'disabled');
    },

    hideSaving: function() {
      this.$button.val(this.original_button_val).removeAttr('disabled');
    }

  });

  this.before({only: {verb: 'get'}}, function() {
    this.showPane('loading');
  });

  this.get('/graphs/new', function(ctx) {
    this.session('lastPreview', Graphiti.defaultGraph, function() {
      ctx.redirect('/graphs/workspace');
    });
  });

  this.get('/graphs/workspace', function(ctx) {
    this.session('lastPreview', function(lastPreview) {
      ctx.showEditor(lastPreview);
    });
  });

  this.get('/graphs/:uuid', function(ctx) {
    this.load('/graphs/' + this.params.uuid + '.js', {cache: false})
        .then(function(graph_data) {
          ctx.showEditor(graph_data.json, ctx.params.uuid);
          ctx.buildSnapshotsDropdown(graph_data.snapshots, true);
        });
  });

  this.get('/graphs/:uuid/intervals', function(ctx) {
    this.load('/graphs/' + this.params.uuid + '.js', {cache: false})
        .then(function(graph_data) {
          ctx.buildIntervalsGraphs(graph_data);
        });
  });

  this.get('/graphs/:uuid/snapshots', function(ctx) {
    if (this.params.snapshot) {
      window.open(this.params.snapshot, this.snapshotURLToDate(this.params.snapshot));
      this.redirect('/graphs', this.params.uuid);
    } else {
      this.loadAndRenderSnapshots();
    }
  });

  this.get('/graphs', function(ctx) {
    this.loadAndRenderGraphs('/graphs.js');
  });

  this.get('/dashboards/:slug', function(ctx) {
    this.loadAndRenderGraphs('/dashboards/' + this.params.slug + '.js');
  });

  this.get('/dashboards', function(ctx) {
    this.loadAndRenderDashboards();
  });

  this.del('/dashboards/:slug', function(ctx){
    var slug = this.params.slug;
    if (this.confirmDelete('dashboard')) {
      $.ajax({
        type: 'post',
        data: '_method=DELETE',
        url: '/dashboards/'+slug,
        complete: function(resp){
          ctx.loadAndRenderDashboards();
        }
      });
    }
  });

  this.del('/graphs/dashboards', function(ctx){
    if (this.confirmDelete('graph')) {
      $.ajax({
        type: 'post',
        data: $(ctx.target).serialize() + '&_method=DELETE',
        url: '/graphs/dashboards',
        success: function(resp){
          ctx.app.refresh();
        }
      });
    }
  });

  this.del('/graphs/:uuid', function(ctx){
    if (this.confirmDelete('graph')) {
      $.ajax({
        type: 'post',
        data: '_method=DELETE',
        url: '/graphs/'+ this.params.uuid,
        success: function(resp){
          ctx.app.refresh();
        }
      });
    }
  });

  this.get('', function(ctx) {
    this.loadAndRenderDashboards();
  });

  this.post('/graphs', function(ctx) {
    ctx.showSaving();
    var graph = new Graphiti.Graph(this.getEditorJSON());
    graph.save(function(resp) {
      ctx.hideSaving();
      Sammy.log('created', resp);
      if (resp.uuid) {
        ctx.redirect('/graphs/' + resp.uuid);
      }
    });
  });

  this.put('/graphs/options', function(ctx) {
    this.saveOptions(this.params.options);
  });

  this.post('/graphs/:uuid/snapshots', function(ctx) {
    ctx.showSaving();
    var graph = new Graphiti.Graph(this.getEditorJSON());
    graph.snapshot(this.params.uuid, function(url) {
      ctx.hideSaving();
      Sammy.log('snapshotted', url);
      if (url) {
        ctx.buildSnapshotsDropdown([url]);
      }
    });
  });

  this.put('/graphs/:uuid', function(ctx) {
    ctx.showSaving();
    var graph = new Graphiti.Graph(this.getEditorJSON());
    graph.save(this.params.uuid, function(response) {
      Sammy.log('updated', response);
      ctx.hideSaving();
      ctx.toggleUpdateAvailability(false);
      ctx.redrawPreview();
    });
  });

  this.post('/graphs/dashboards', function(ctx) {
    var $target = $(this.target);
    $.post('/graphs/dashboards', $target.serialize(), function(resp) {
      ctx.buildDashboardsDropdown(resp.uuid);
    });
  });

  this.post('/dashboards', function(ctx) {
    var $target = $(this.target);
    $.post('/dashboards', $target.serialize(), function(resp) {
      $target.find('input[type=text]').val('');
      ctx.buildDashboardsDropdown();
      ctx.trigger('toggle-dashboard-creation', {target: $target.parents('.dashboard')});
    });
  });

  this.bind('toggle-dashboard-creation', function(e, data) {
    var $parent = $(data.target);
    var $new = $parent.find('.new-dashboard');
    var $add = $parent.find('.add-to-dashboard');
    if ($new.is(':visible')) {
      $new.hide(); $add.show();
    } else {
      $new.show(); $add.hide();
    }
  });

  this.bind('change-interval', function(e, data) {
    this.setOptions({from: data.interval});
  });

  this.registerShortcut('redraw-preview', 'g', function() {
    this.toggleUpdateAvailability(true);
    this.redrawPreview();
  });

  this.bind('run', function() {
    var ctx = this;

    this.bindEditorPanes();
    this.bindIntervalToggling();
    this.bindMetricsList();

    var disableSave = function() {
      if ($(this).val().toString() == '') {
        $(this).siblings('.save').attr('disabled', 'disabled');
      } else {
        $(this).siblings('.save').removeAttr('disabled');
      }
    };
    $('select[name="dashboard"]')
      .live('click', disableSave)
      .live('focus', disableSave)
      .live('blur', disableSave);

    $('.dashboard button[rel=create], .dashboard a[rel="cancel"]').live('click', function(e) {
      e.preventDefault();
      ctx.trigger('toggle-dashboard-creation', {target: $(this).parents('.dashboard')});
    });

    $('#graph-actions').delegate('.redraw', 'click', function(e) {
      e.preventDefault();
      ctx.toggleUpdateAvailability(true);
      ctx.redrawPreview();
    });
  });

});

$(function() {
  app.run();
});
