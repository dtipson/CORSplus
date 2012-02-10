/*
  API for accessing/changing counters or values.  Requires jQuery 1.6 or above and JSON.parse/stringify
  
  usage:
  
  hashC.methodname(['an','array','of','keys']).then(function(d){  
    //behavior on success, d is an object containg the k/v pairs of either counters or values
  },function(e){  
    //optional: what to do if the request fails, if anything. e may contain an error message at e.error if the API is still responding: 200 responses with 'error' will still fail properly
  });
  
  Core methods:
    counters: takes any array of counter keys and returns the corresponding counter values
    values: takes an array of value keys and returns the corresponding values (can be stringified JSON)
    priCounters/priValues: same behavior, only will attempt a read of private counters or values instead
    
    note that counter ids can either be a pipe separated list of keys or particular keys with =+1 appended to them to signify which keys to increment.  
    So, ['a','b','c=+1','d'] will return the counter values of a, b, c, and d, with just the c value having been incremented by one
  
  Underlying Logic: any of the core methods will first try to do a CORS post.  If that doesn't work, they will attempt to use a single jsonp request.  If that request is too large, it will batch the jsonp calls into several calls and combine the final result into a single response
  
*/
 
(function($){

var hcUrl = '//your.domain.com/', //your CORS-y resource here
	maxUrlLength = 2000,  //2000 characters is probably safe. set lower to force it to batch things for testing purposes
	hashC ={
          timeout: 10000, 
          cors: $.support.cors, //so we know from the start if the client can do CORS
          buildQS: function (q,postm){
            q.ids = q.ids||[]; //if no ids were passed, don't cause an error
            /*now build a standard query from the paramaters we got*/
            return hcURL+((q.v)?"values/":"counters/") + ((q.p)?"private":"") + ((!postm)?"/"+q.ids.join("|"):"") + ((!!q.i && !q.v) ? "/increment" : "");
          },
          counters: function(ids){  //counters are numerical, the ids/keys match numbers
            return this.xpost({'ids':ids});
          },
          values: function(ids){  //values are ids/keys matching strings
            return this.xpost({'ids':ids,'v':true});          
          },
          priCounters: function(ids){  //if there is a private path (authenticated in some way by the server)
            return this.xpost({'ids':ids,p:true});          
          },
          priValues: function(ids){
            return this.xpost({'ids':ids,'v':true,p:true});          
          },
          xpost: function (q) { //master wrapping function, handles CORS request via a Deferred, or falls back to a batch request
            var xdr = $.Deferred(),  //master Deferred
            msdf, //for IE
            url = this.buildQS(q,true), //convert the original function parameters into a standard query
            data = {'ids': q.ids.join("|")}; 
            
            if(!this.cors){ //no cors support: use jsonp
				return hashC.rwJSONP(q); //return the promise from the jsonp request
            }
            else if ($.browser.msie && window.XDomainRequest) {  //handle IE
                msdf = new XDomainRequest();
                msdf.open("post", url);
                msdf.onprogress = function() {}; //f-ing IE9
                msdf.onload = function () {
                  xdr.resolve(JSON.parse(this.responseText));
                };
                msdf.onerror = function () {
                  xdr.reject();
                };
                msdf.ontimeout = function () {
                  xdr.reject();
                };
                msdf.send($.param(data));
            } else {
                xdr = this.pipeFilter($.ajax({ //basic ajax request for modern browsers
                    "url": url,
                    type: "POST",
                    "data": data,
                    dataType: "json"
                }),q);
            }
            //handle cases in which the api is returning data, but it's actually an error
            return xdr.promise();  
          },
          pipeFilter: function(promise, query){
          	var r={};
			promise.pipe(function(d){
				//if the API is returning data 200, but has an error message instead of data, we'll set it to register as a fail
				if (!d.error){
					if(d.count){
						//api I was using would return single id results with id name of "count" instead of the id. 
						//This fixes that. Just return d and remove the conditional
						r[q.ids[0]] = d.count; 
						return r;
					} else {
						return d;
					}
				}
				else {
					return( $.Deferred().reject(d) );  //fail: return a new rejected deferred
				}
			},function(d){
				//if the request errors out immediately, then a CORS POST may not work after all, even though client said it could handle it. 
				//we'll switch to the backup jsonp method
				return hashC.rwJSONP(q);
			});
			return promise;
          },
          rwJSONP: function (q) {
            var url = this.buildQS(q,false),
            	df;
            if(url.length>maxUrlLength) {
            //oops, this query string is way, way too long.  We're gonna to have to batch it
              return this.batchIt(q);
            }
            else{ 
            //we don't need no stinkin batches!
              df = pipeFilter($.ajax({
                url: url + "?format=jsonp",
                timeout: this.timeout,
                dataType: "jsonp"
              }),q);
              return df.promise();
            }
          },
          batchIt: function(q){
            var b = $.Deferred(), //the master promise we'll eventually return
              batches = [], //collection of requests, each of which will be a promise
              per=3, //rough idea of how many ids to send at once
              nq, // variable to hold each new query string
              nids=[]; //array to hold a growing list of ids, emptied for each new batch
           
            $.each(q.ids,function(i,v){
              nids.push(v); //put the next value in the temp array
              if (nids.length===per) {  //check to see if the length is enough to complete a batch
                nq = $.extend({}, q); //create a new query with all the same options as the original
                nq.ids = nids; //overwrite the ids with a new, shorter collection
                batches.push(hashC.rwJSONP(nq,true));  //insert the completed promise into the batches array
                nids = []; //empty the collection in case we need to create a new batch
              }
            });
            
            $.when.apply(this,batches).then(function(){
              //need to merge all the arguments back together into a single result, oy
              var result ={}; //our final result
              $.each(arguments,function(i,v){
              	//mix the ids from this batch back into the final results object.  note that it's [0], not [i], because we're iterating over arrays arguments, which each contain collections, not the collections directly
                $.extend(result,v[0]); 
              });
              b.resolve(result); //all the batches came in, so resolve it
            },function(){
              b.reject(); //one of the batches failed.  darn
            });
            return b.promise(); //the whole function will then return a promise, just as if this were a single CORS POST returning
          }
};

window.hashC = hashC;
}(jQuery));