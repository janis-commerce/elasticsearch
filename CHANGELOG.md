# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2019-09-12
### Added
- `ElasticSearchConfigError`
- `ConfigValidator` module for config datatypes validation
- `prefix` support for table names

## [1.0.2] - 2019-08-29
### Fixed
- `getTotals` params obtained from latest `get` operation
- Error handling improved, and clear messages added for most common ElasticSearch errors

## [1.0.1] - 2019-08-28
### Fixed
- AWS Authentication
- `lastModified` field name changed to `dateModified`

## [1.0.0] - 2019-08-27
### Added
- ElasticSearch package
- Unit tests
- Docs