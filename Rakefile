require 'rubygems'
require 'bundler'
begin
  Bundler.setup(:default, :development)
rescue Bundler::BundlerError => e
  $stderr.puts e.message
  $stderr.puts "Run `bundle install` to install missing gems"
  exit e.status_code
end

require 'rake'
require File.join(File.dirname(__FILE__), 'graphiti')

require 'rake/testtask'
Rake::TestTask.new(:test) do |test|
  test.libs << 'lib' << 'test'
  test.pattern = 'test/**/test_*.rb'
  test.verbose = true
end

task :default => :test

namespace :graphiti do

  desc 'Rebuild Metrics List'
  task :metrics do
    list = Metric.all true
    puts "Got #{list.length} metrics"
  end

  desc 'Send email reports per dashboard. Needs `reports` settings in settings.yml'
  task :send_reports do
    Dashboard.send_reports
  end

  desc 'Import graphiti graphs from the list of graphite urls'
  task :import, :source do |t, args|
    # try running this in chrome javascript console on a graphite dashboard page $x("//img/@src").forEach(function(x) { console.log(x.value) })
    if args[:source] == "-"
      f = STDIN
    else
      f = File.open(args[:source])
    end

    f.each do |url|
      Graph.save(Graph.parse_graphite(url))
    end
  end

end
