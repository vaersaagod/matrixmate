# MatrixMate Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## 1.1.2 - 2019-04-26
### Fixed
- Improves field config parsing and general code quality
- Fixes an issue with maxLimit not being honored for ungrouped block types

## 1.1.1 - 2019-04-23
### Fixed
- Fixes an issue where MatrixMate would mess up field config contexts if neither a `fields` nor `groups` config was added to a field  

## 1.1.0 - 2019-04-21
### Added
- Adds `hiddenTypes` setting for explicitly hiding block types
- Adds `defaultTabName` setting
### Improved
- MatrixMate no longer hides ungrouped block types by default
- It's now possible to add the same block type to multiple groups
- MatrixMate no longer renders empty groups or types

## 1.0.0 - 2019-02-07
### Added
- Initial release
