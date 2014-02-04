require 'uri'

class Metric
  include Redised

  def self.all(refresh = false)
    redis_metrics = redis.get("metrics")
    @metrics = redis_metrics.split("\n") if redis_metrics
    return @metrics if @metrics && !@metrics.empty? && !refresh
    @metrics = []
    get_metrics_list
    redis.set "metrics", @metrics.join("\n")
    @metrics
  end

  def self.find(match, max = 100)
    match = match.to_s.strip
    matches = []
    all.each do |m|
      if m =~ /#{match.strip}/i
        matches << m
      end
      break if matches.length > max
    end
    matches
  end

  private
  def self.get_metrics_list(prefix = Graphiti.settings.metric_prefix)
    uri = URI("#{Graphiti.settings.graphite_base_url}")
    
    auth_name = "#{Graphiti.settings.auth_name}"
    auth_pwrd = "#{Graphiti.settings.auth_pwrd}"
    if auth_name != "" and auth_pwrd != ""
      url_string = "#{uri.scheme}://#{auth_name}:#{auth_pwrd}@#{uri.host}"
      url_string = uri.port != "" ? "#{url_string}:#{uri.port}" : url_string
      elsif
      url_string = "#{uri}"
    end

    uri = URI.join(url_string, "/metrics/index.json")

    puts "Getting #{uri}"
    response = Typhoeus::Request.get("#{uri}")
    if response.success?
      json = Yajl::Parser.parse(response.body)
      if prefix.nil?
        @metrics = json
      elsif prefix.kind_of?(Array)
        @metrics = json.grep(/^[#{prefix.map! { |k| Regexp.escape k }.join("|")}]/)
      else
        @metrics = json.grep(/^#{Regexp.escape prefix}/)
      end
    else
      puts "Error fetching #{url}. #{response.inspect}"
    end
    @metrics.sort
  end

end
