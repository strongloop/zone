# set ZONE=yes to run bench with zones

bench-net:
	node benchmark/common.js net

bench-tls: 
	node benchmark/common.js tls

bench-http: 
	node benchmark/common.js http

bench-fs: 
	node benchmark/common.js fs

bench-vanilla: bench-net bench-http bench-fs bench-tls

bench-zones: 
	export ZONE=yes && make bench-vanilla

bench: bench-zones bench-vanilla

.PHONY: bench bench-zones bench-vanilla
