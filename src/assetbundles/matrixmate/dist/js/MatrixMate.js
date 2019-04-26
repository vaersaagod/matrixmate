/**
 * MatrixMate plugin for Craft CMS
 *
 * MatrixMate JS
 *
 * @author    Værsågod
 * @copyright Copyright (c) 2019 Værsågod
 * @link      https://vaersaagod.no
 * @package   MatrixMate
 * @since     1.0.0
 */

/** global: jQuery */
/** global: Craft */
/** global: Garnish */

(function ($) {

    if (!Craft || !Craft.MatrixInput) {
        return;
    }

    Craft.MatrixMate = Garnish.Base.extend(
        {
            init: function (settings) {

                this.setSettings(settings, Craft.MatrixMate.defaults);

                // Change context when the entry type changes
                if (Craft.EntryTypeSwitcher) {
                    Garnish.on(Craft.EntryTypeSwitcher, 'beforeTypeChange', $.proxy(function (e) {
                        this.settings.context = 'entryType:' + e.target.$typeSelect.val();
                    }, this));
                }

                // If this is a versioned entry, initialise existing blocks directly from the DOM
                if (this.settings.isEntryVersion) {
                    Garnish.$doc.find('.matrix-field').each($.proxy(function (idx, field) {
                        this.initField($(field));
                    }, this));
                }

                // Override the native MatrixInput::addBlock() method
                var _this = this;
                var addBlockFn = Craft.MatrixInput.prototype.addBlock;
                Craft.MatrixInput.prototype.addBlock = function (type, $insertBefore) {
                    var $field = this.$container;
                    var typeConfig = _this._getTypeConfig(type, $field);
                    if (typeConfig) {
                        var maxLimit = typeConfig.maxLimit;
                        if (maxLimit !== undefined && maxLimit != null && _this._countBlockByType(type, $field) >= maxLimit) {
                            return;
                        }
                    }
                    addBlockFn.apply(this, arguments);
                    Garnish.requestAnimationFrame($.proxy(function () {
                        _this._maybeDisableBlockType(type, $field);
                    }, this));
                }

                // Override the native MatrixInput::updateAddBlockBtn method
                var updateAddBlockBtnFn = Craft.MatrixInput.prototype.updateAddBlockBtn;
                Craft.MatrixInput.prototype.updateAddBlockBtn = function () {
                    updateAddBlockBtnFn.apply(this, arguments);
                    Garnish.requestAnimationFrame($.proxy(function () {
                        _this._maybeDisableBlockTypes(this.$container);
                    }, this));
                }

                // Add event listeners
                Garnish.on(Craft.MatrixInput, 'afterInit', $.proxy(this.onMatrixInputInit, this));
                Garnish.on(Craft.MatrixInput, 'blockAdded', $.proxy(this.onMatrixInputBlockAdded, this));

            },

            // Initialises a Matrix field, including block type groups and tabs
            initField: function ($field) {

                if ($field.hasClass('matrixmate-inited')) {
                    return;
                }

                $field.addClass('matrixmate-inited');

                var fieldConfig = this._getFieldConfig($field);
                if (!fieldConfig) {
                    return;
                }

                // Init group buttons
                this._initBlockTypeGroups($field, fieldConfig);

                // Hide types that should be, er, hidden
                this._hideBlockTypes($field, fieldConfig);

                // Init blocks
                var $blocks = $field.data('matrix').$blockContainer.children();
                $blocks.each($.proxy(function (index, block) {
                    this.initBlock($(block), $field);
                }, this));
            },

            // Initialises a Matrix block, including the settings menu and tabs
            initBlock: function ($block, $field) {

                if ($block.data('matrixmate_inited')) {
                    return;
                }

                $block.data('matrixmate_inited', true);

                var fieldConfig = this._getFieldConfig($field);
                if (!fieldConfig) {
                    return;
                }

                // Init block settings menu
                this._initBlockSettingsMenu($block, $field, fieldConfig);

                // Init block tabs
                this._initBlockTabs($block, $field, fieldConfig);

            },

            _hideBlockTypes($field, fieldConfig) {

                if (this.settings.isEntryVersion) {
                    return;
                }

                var hiddenTypes = fieldConfig.hiddenTypes || [];

                if (!hiddenTypes.length) {
                    return;
                }

                var $matrixButtons = $field.find('> .buttons').first();

                if (!$matrixButtons.length) {
                    return;
                }

                var $buttonsToHide = $matrixButtons.find('.btn[data-type]').filter(function () {
                    var type = $(this).data('type');
                    return type && hiddenTypes.indexOf(type) > -1;
                });

                $buttonsToHide.addClass('hidden');

                // Make sure the first visible type button has the + icons
                $matrixButtons.find('.btn.add.icon').removeClass('add icon');
                $matrixButtons.find('.btn[data-type]:visible').first().addClass('add icon');

                // Also hide from the collapsed menu
                var $menuBtn = $field.find('> .buttons').first().find('.btn.menubtn');
                var collapsedMenu = $menuBtn.length ? ($menuBtn.data('menubtn') || {}).menu || null : null;
                var $collapsedMenuContainer = collapsedMenu ? collapsedMenu.$container || null : null;
                if ($collapsedMenuContainer) {
                    $collapsedMenuContainer.find('a[data-type]').each(function () {
                        if (hiddenTypes.indexOf($(this).data('type')) > -1) {
                            $(this).parent('li').addClass('hidden');
                        }
                    });
                }

            },

            _initBlockTypeGroups($field, fieldConfig) {

                if (this.settings.isEntryVersion) {
                    return;
                }

                var groupsConfig = fieldConfig['groups'] || null;
                if (!groupsConfig) {
                    return;
                }

                var $origButtons = $field.find('> .buttons').first();
                $origButtons.addClass('hidden');

                var $matrixmateButtonsContainer = $('<div class="matrixmate-buttons" />').insertAfter($origButtons);
                var $matrixmateButtons = $('<div class="btngroup" />').appendTo($matrixmateButtonsContainer);

                var $collapsedButtons = $('<div class="btn add icon menubtn hidden">' + Craft.t('app', 'Add a block') + '</div>').appendTo($matrixmateButtonsContainer);
                var $collapsedMenu = $('<div class="menu matrixmate-collapsed-menu" />').appendTo($matrixmateButtonsContainer);

                // Create button groups
                var c = 0;
                var hiddenTypes = fieldConfig.hiddenTypes || [];
                var usedTypes = [];
                for (var i = 0; i < groupsConfig.length; i++) {

                    // Get group label
                    var label = groupsConfig[i]['label'] || null;
                    if (!label) {
                        continue;
                    }

                    // Get types for this group
                    types = (groupsConfig[i]['types'] || []).filter(function (typeHandle) {
                        return hiddenTypes.indexOf(typeHandle) === -1;
                    });
                    if (!types.length) {
                        continue;
                    }

                    var $mainMenuBtn = $('<div class="btn menubtn">' + label + '</div>').appendTo($matrixmateButtons);
                    var $mainMenu = $('<div class="menu" data-matrixmate-group="' + label + '" />').appendTo($matrixmateButtons);
                    var $mainUl = $('<ul />').appendTo($mainMenu);

                    if (c > 0) {
                        $('<hr/>').appendTo($collapsedMenu);
                    }

                    $('<h6>' + label + '</h6>').appendTo($collapsedMenu);
                    var $collapsedUl = $('<ul/>').appendTo($collapsedMenu);

                    // Create the type buttons inside the groups
                    for (var j = 0; j < types.length; ++j) {

                        var type = types[j];
                        usedTypes.push(type);

                        var $origTypeBtn = $origButtons.find('.btn[data-type="' + type + '"]');
                        if (!$origTypeBtn.length) {
                            continue;
                        }

                        var $li = $('<li/>');
                        var $a = $('<a/>').attr('data-type', type).text($origTypeBtn.text());

                        $li.append($a).appendTo($mainUl);
                        $li.clone().appendTo($collapsedUl);

                    }

                    c++;

                }

                // Create vanilla buttons for ungrouped types
                var hideUngrouped = !!fieldConfig.hideUngroupedTypes;
                if (!hideUngrouped) {

                    // Get ungrouped, original buttons
                    $hiddenUngroupedOrigButtons =  $($origButtons.find('.btn[data-type]').filter(function (index, button) {
                        var type = $(button).data('type');
                        return type && hiddenTypes.indexOf(type) === -1 && usedTypes.indexOf(type) === -1;
                    }).get().reverse());

                    if ($hiddenUngroupedOrigButtons.length) {
                        var $ul = $('<ul />');
                        $hiddenUngroupedOrigButtons.each(function (index) {
                            var $btn = $(this).clone();
                            if (index === $hiddenUngroupedOrigButtons.length - 1) {
                                $btn.addClass('icon add');
                            }
                            $matrixmateButtons.prepend($btn);
                            var type = $btn.data('type');
                            var $li = $('<li/>');
                            var $a = $('<a/>').attr('data-type', type).text($btn.text());
                            $li.append($a).prependTo($ul);
                        });
                        $collapsedMenu.prepend('<hr />').prepend($ul);
                        $matrixmateButtons.on('click', '> .btn[data-type]', function () {
                            var type = $(this).data('type');
                            if (!type) {
                                return;
                            }
                            $origButtons.find('[data-type="' + type + '"]').trigger('click');
                        });
                    }
                }

                // Init menu button components
                $matrixmateButtons.find('.menubtn').each(function () {
                    new Garnish.MenuBtn($(this), {
                        onOptionSelect: function (option) {
                            var type = $(option).data('type');
                            $origButtons.find('[data-type="' + type + '"]').trigger('click');
                        }
                    });

                });

                // Init menu buttons for the collapsed menu
                new Garnish.MenuBtn($collapsedButtons, {
                    onOptionSelect: function (option) {
                        var type = $(option).data('type');
                        $origButtons.find('[data-type="' + type + '"]').trigger('click');
                    }
                });

                this.addListener($field, 'resize', $.proxy(function () {
                    if (!$field.data('matrixmate-buttons-width')) {
                        $field.data('matrixmate-buttons-width', $matrixmateButtons.width());
                        if (!$field.data('matrixmate-buttons-width')) {
                            return;
                        }
                    }
                    if ($field.width() < $field.data('matrixmate-buttons-width')) {
                        $collapsedButtons.removeClass('hidden');
                        $matrixmateButtons.addClass('hidden');
                    } else {
                        $collapsedButtons.addClass('hidden');
                        $matrixmateButtons.removeClass('hidden');
                    }
                }, this));

            },

            _initBlockTabs: function ($block, $field, fieldConfig) {

                if ($block.hasClass('matrixmate-block-inited')) {
                    return;
                }

                $block.addClass('matrixmate-block-inited');

                if (this.settings.isEntryVersion) {
                    $block.addClass('disabled');
                }

                var type = $block.data('type');
                var typeConfig = this._getTypeConfig(type, $field);
                if (!typeConfig || !typeConfig.tabs) {
                    return;
                }

                var tabs = typeConfig.tabs;
                if (typeConfig['defaultTabName'] || null) {
                    tabs.push({
                        label: typeConfig.defaultTabName,
                        isDefaultTab: true
                    });
                }

                if (tabs.length < 2) {
                    return;
                }

                var namespace = $field.prop('id') + '-' + $block.data('id');
                var matrixmateNamespace = 'matrixmate-' + namespace;

                var $tabs = $('<ul class="matrixmate-tabs"/>').appendTo($block);
                var $matrixmateFields = $('<div class="matrixmate-fields"/>').css({ 'opacity': 0 }).appendTo($block);
                var $fields = $block.find('> .fields');
                $fields.css({ 'opacity': 0 });

                // Create tabs
                var usedFields = [];

                var tabIndex = 0;
                for (var i = 0; i < tabs.length; i++) {

                    var navClasses = '';
                    var paneClasses = '';

                    if (tabIndex === 0) {
                        navClasses = ' sel';
                    } else {
                        paneClasses = ' hidden';
                    }

                    var $pane = $('<div id="' + matrixmateNamespace + '-pane-' + i + '" class="' + paneClasses + '"/>');

                    var tabFieldHandles = tabs[i]['fields'] || [];
                    $fields.find('> .field').each($.proxy(function (index, field) {
                        var $field = $(field);
                        var handle = this._getBlockFieldHandle($field);
                        if (!handle || usedFields.indexOf(handle) > -1) {
                            return;
                        }
                        if (!tabs[i].isDefaultTab && tabFieldHandles.indexOf(handle) === -1) {
                            return;
                        }
                        usedFields.push(handle);
                        $pane.append($field.attr('data-matrixmate-field', true));
                    }, this));

                    if (!$pane.find('[data-matrixmate-field]').length) {
                        continue;
                    }

                    $pane.appendTo($matrixmateFields);

                    var $tabLi = $('<li/>').appendTo($tabs);
                    var $tabA = $('<a id="' + matrixmateNamespace + '-' + i + '" class="tab' + navClasses + '">' + tabs[i].label + '</a>')
                        .appendTo($tabLi)
                        .data('matrixmate-tabtarget', '#' + matrixmateNamespace + '-pane-' + i);

                    if ($pane.find('.field.has-errors').length > 0) {
                        $tabA.addClass('error');
                        $tabA.append(' <span data-icon="alert" />');
                    }

                    tabIndex++;

                }

                this.addListener($tabs.find('a'), 'click', 'onBlockTabClick');

                $matrixmateFields.velocity({ opacity: 1 }, 'fast', $.proxy(function () {
                    Craft.initUiElements($matrixmateFields);
                }, this));

                $fields.hide();

            },

            _initBlockSettingsMenu: function ($block, $field, fieldConfig) {

                if (this.settings.isEntryVersion) {
                    return;
                }

                Garnish.requestAnimationFrame($.proxy(function () {

                    var $settingsBtn = $block.find('.actions .settings.menubtn');
                    var menuBtn = $settingsBtn.length ? $settingsBtn.data('menubtn') || null : null;

                    if (!menuBtn) {
                        this._initBlockSettingsMenu($block, $field, fieldConfig);
                        return;
                    }


                    var $menu = menuBtn.menu.$container || null;
                    if (!$menu) {
                        return;
                    }

                    $menu
                        .addClass('matrixmate-settings-menu')
                        .find('a[data-action="add"]')
                        .parents('li')
                        .addClass('hidden');

                    $menu.find('hr').removeClass('padded');

                    var $origUl = $menu.find('a[data-action="add"]').parents('li').parent('ul');

                    var groupsConfig = fieldConfig['groups'] || null;

                    // Create groups
                    var usedTypes = [];
                    if (groupsConfig) {
                        var c = 0;
                        for (var i = 0; i < groupsConfig.length; i++) {

                            var label = groupsConfig[i]['label'] || null;
                            if (!label) {
                                continue;
                            }

                            var $newUl = $('<ul class="padded" data-matrixmate-group="' + label + '" />');
                            if (c > 0) {
                                $('<hr/>').insertBefore($origUl);
                            }

                            $('<h6>' + label + '</h6>').insertBefore($origUl);
                            $newUl.insertBefore($origUl);

                            // Create type buttons
                            var types = groupsConfig[i]['types'] || [];
                            var type;
                            for (var j = 0; j < types.length; ++j) {
                                type = types[j];
                                usedTypes.push(type);
                                var $li = $menu.find('a[data-type="' + type + '"]').parents('li').first();
                                if (!$li.length) {
                                    continue;
                                }
                                $li = $li.clone().removeClass('hidden');
                                $newUl.append($li);
                            }

                            c++;

                        }
                    }

                    // Un-hide un-grouped types that aren't explicitly hidden :P
                    var hiddenTypes = fieldConfig.hiddenTypes || [];
                    var hasGroupConfig = !!(fieldConfig['groups'] || null);
                    var hideUngrouped = (!!fieldConfig.hideUngroupedTypes);
                    var $a;
                    var type;
                    var lis = [];
                    $menu.find('li.hidden a[data-action="add"]').each(function () {
                        $a = $(this);
                        type = $a.data('type');
                        if (usedTypes.indexOf(type) === -1 && (!hideUngrouped || !hasGroupConfig) && hiddenTypes.indexOf(type) === -1) {
                            lis.push($a.parent('li').clone().removeClass('hidden'));
                        }
                    });
                    if (lis.length) {
                        var $ul = $('<ul data-matrixmate-group class="padded"/>');
                        $ul.append(lis);
                        var $customHeading = $menu.find('h6').first();
                        if ($customHeading.length) {
                            $customHeading.before($ul);
                            $ul.after('<hr />');
                        } else {
                            $menu.append($ul);
                        }
                    }

                    $menu.on('click', '[data-matrixmate-group] a[data-action="add"]', function () {
                        var type = $(this).data('type');
                        if (!type) {
                            return;
                        }
                        $menu.find('ul:not([data-matrixmate-group]) a[data-action="add"][data-type="' + type + '"]').trigger('click');
                    });

                }, this));

            },

            _getFieldHandle: function ($field) {
                return $field.attr('id').split('-').pop();
            },

            _getBlockFieldHandle: function ($field) {
                return $field.attr('id').split('-')[4] || null;
            },

            _getFieldConfig: function ($field) {
                var config = $field.data('matrixmateconfig');
                if (config !== undefined) {
                    return config;
                }
                var handle = this._getFieldHandle($field);
                if (!handle) {
                    return null;
                }
                var fieldConfig = this.settings.fieldsConfig[handle] || null;
                if (!fieldConfig) {
                    return null;
                }
                config = fieldConfig[this.settings.context] || fieldConfig['*'] || null;
                $field.data('matrixmateconfig', config);
                return config;
            },

            _getTypeConfig: function (type, $field) {
                var fieldConfig = this._getFieldConfig($field);
                if (!fieldConfig || !(fieldConfig['types'] || null)) {
                    return null;
                }
                return fieldConfig.types[type] || null;
            },

            _countBlockByType: function (type, $field) {
                return $field.find('.matrixblock[data-type="' + type + '"]').length;
            },

            _maybeDisableBlockTypes($field) {
                var fieldConfig = this._getFieldConfig($field);
                if (!fieldConfig) {
                    return;
                }
                var types = Object.keys(fieldConfig.types || {});
                for (var i = 0; i < types.length; ++i) {
                    this._maybeDisableBlockType(types[i], $field);
                }
            },

            _maybeDisableBlockType(type, $field) {

                var typeConfig = this._getTypeConfig(type, $field) || {};
                var maxLimit = typeConfig.maxLimit || null;

                if (maxLimit === null) {
                    return;
                }

                var currentCount = this._countBlockByType(type, $field);
                var disable = currentCount >= maxLimit;

                // Update Add buttons
                $field.find('> .buttons .btn[data-type="' + type + '"], > .matrixmate-buttons .btn[data-type="' + type + '"]').each(function () {
                    if (disable) {
                        $(this).addClass('disabled');
                    } else {
                        $(this).removeClass('disabled');
                    }
                });

                // Update Add buttons in Garnish menus
                var menuBtn;
                $field.find('> .buttons .btn.add.menubtn, > .matrixmate-buttons .btn.menubtn, .matrixblock .settings.menubtn').each(function () {
                    menuBtn = $(this).data('menubtn');
                    if (!menuBtn) {
                        return;
                    }
                    menuBtn.menu.$container.find('a[data-type="' + type + '"]').each(function () {
                        if (disable) {
                            $(this).addClass('disabled');
                        } else {
                            $(this).removeClass('disabled');
                        }
                    });
                });
            },

            onBlockTabClick: function (e) {

                e.preventDefault();
                e.stopPropagation();

                var $tab = $(e.target);
                var $tabsContainer = $tab.parent().parent('.matrixmate-tabs');
                var targetSelector = $tab.data('matrixmate-tabtarget');

                if (!$tabsContainer.length || !targetSelector) {
                    return;
                }

                var $target = $(targetSelector);
                if (!$target.length) {
                    return;
                }

                $tabsContainer.find('a.sel').removeClass('sel');
                $tab.addClass('sel');

                $target.siblings('div').addClass('hidden');
                $target.removeClass('hidden');

            },

            onMatrixInputInit: function (e) {
                this.initField(e.target.$container);
            },

            onMatrixInputBlockAdded: function (e) {
                this.initBlock(e.$block, e.target.$container);
            }

        }, {
            defaults: {
                context: false,
                fieldsConfig: {},
                isEntryVersion: false
            }
        });

})(jQuery);
