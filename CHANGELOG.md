# MatrixMate Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased
### Fixed
- Fixes an issue where MatrixMate could make Craft create a provisional draft even if there were no changes to the entry edit form

## 1.3.2 - 2021-12-13
### Fixed  
- Fixes an issue where MatrixMate could fail to apply the correct field config for provisional drafts  

## 1.3.1 - 2021-11-16

### Fixed  
- Fixes a JavaScript error that could occur when opening element editor slideouts and HUDs  
- Fixes a bug where the entry type switcher would not reload the MatrixMate config in element editor HUDs prior to Craft 3.7.x  
- Fixes a bug where MatrixMate could fail to apply the correct config for entry types in element editor slideouts on Craft 3.7.x   

## 1.3.0 - 2021-11-12  

### Fixed  
- Fixed an issue where MatrixMate could apply the wrong config to a draft, if the draft was using a different entry type from the canonical entry.
- Fixed an issue where Matrix sub fields could render gray separator lines outside the Matrix field container, when using MatrixMate's tabs feature.

### Added
- Added the `defaultTabFirst` config setting for tabs, to allow displaying the default tab first

## 1.2.7 - 2020-08-15

### Fixed
- Fixes issue where custom field widths would not render inside MatrixMate's block type tabs

## 1.2.6 - 2020-07-30

### Fixed
- Fixes compatability issues with Craft 3.5  

## 1.2.5 - 2020-02-29  

### Fixed  
- Fixes an issue where MatrixMate could fail to apply the correct field config in multi-site setups

### Improved
- Removes the bottom border from Matrix blocks' titlebars for block types with tabs (P&T removed the native border in Craft 3.4.5 and then re-added it in 3.4.7)

## 1.2.4 - 2020-02-15

### Improved
- Adds a bottom border to Matrix blocks' titlebars for block types with tabs (the native bottom border was removed in Craft 3.4.5) - thanks @umkasanki

## 1.2.3 - 2020-01-28

### Fixed
- Fixes Craft 3.4 compatibility issues  

## 1.2.2 - 2019-09-29

### Fixed
- Fixes an issue where MatrixMate could fail to apply the correct field config context in element editor modals. Fixes #10.
- Fixes an issue where MatrixMate would hide block content when viewing entry revisions in Craft 3.2+. Fixes #11.
- Fixes an issue where MatrixMate could fail to apply the correct field config context if the URL had a `typeId` query parameter.  

## 1.2.1 - 2019-09-04

### Fixed
- Fixes an issue where MatrixMate could make Craft trigger the "Leave site?" confirm dialog, even if no fields in the entry form had been altered

## 1.2.0 - 2019-08-30

### Added
- Added the `hiddenFields` config setting for block type configs, which makes it possible to hide specific fields without having to use the `tabs` setting  

### Changed
- MatrixMate will now render tabs even if there is only a single tab defined in config (but it will only display tab buttons in block headers if there is more than one tab rendered). Fixes #9

## 1.1.5 - 2019-05-29

### Fixed
- Fixes issues related to Matrix fields nested in SuperTable fields  

## 1.1.4 - 2019-05-10

### Fixed
- Fixes a namespace typo that could make Composer choke in case-sensitive environments. Thanks a lot @Mosnar!  

## 1.1.3 - 2019-05-09

### Fixed
- Fixes a layout glitch that could happen when collapsing block types with field tabs within them
- Fixes a layout glitch where block group dropdown menus could display scrollbars

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
