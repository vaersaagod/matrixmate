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

    const MATRIX_MATE_KEY = 'matrixMate';

    Craft.MatrixMate = {
        fieldConfig: null,
        elementContexts: {},
        initPrimaryForm(elementId, context) {
            if (Craft.cp.$primaryForm && Craft.cp.$primaryForm.length) {
                Craft.cp.$primaryForm.data('matrixMateContext', context);
            }
            this.elementContexts[`${elementId}`] = context;
        },
        getContextForElement(elementId) {
            return this.elementContexts[`${elementId}`] || '*';
        },
        getConfigForField($field, context) {
            if (!context) {
                return null;
            }
            const handle = $field.attr('id').split('-').pop();
            const fieldConfig = this.fieldConfig[handle] || null;
            if (!fieldConfig) {
                return null;
            }
            return fieldConfig[context] || fieldConfig['*'] || null;
        },
        maybeOverrideInitialSerializedForm($form) {
            setTimeout(() => {
                const { elementEditor } = $form.data();
                if (!elementEditor) {
                    return;
                }
                const data = elementEditor.serializeForm(true);
                if (data === $form.data('initialSerializedValue') && data === elementEditor.lastSerializedValue) {
                    return;
                }
                $form.data('initialSerializedValue', data);
                elementEditor.lastSerializedValue = data;
            }, 0);
        }
    };

    Craft.MatrixMateField = Garnish.Base.extend({
        init($field) {
            if ($field.data(MATRIX_MATE_KEY)) {
                return;
            }
            this.$field = $field;
            this.$field.addClass('matrixmate-inited');
            this.matrix = this.$field.data('matrix');
            this.$form = this.matrix.$form;
            this.config = Craft.MatrixMate.getConfigForField(this.$field, this.$form.data('matrixMateContext'));
            if (!this.config) {
                return;
            }
            this.initBlockTypeGroups();
            this.hideBlockTypes();
            this.initBlocks();
            this.maybeDisableBlockTypes();
            this.$field.data(MATRIX_MATE_KEY, this);
            Craft.MatrixMate.maybeOverrideInitialSerializedForm(this.$form);
        },
        initBlockTypeGroups() {

            const groupsConfig = this.config.groups || null;
            if (!groupsConfig) {
                return;
            }

            const $origButtons = this.$field.find('> .buttons').first();
            $origButtons.addClass('hidden');

            const $matrixmateButtonsContainer = $('<div class="matrixmate-buttons" />').insertAfter($origButtons);
            const $matrixmateButtons = $('<div class="btngroup" />').appendTo($matrixmateButtonsContainer);
            const $collapsedButtons = $('<div class="btn add icon menubtn hidden">' + Craft.t('app', 'Add a block') + '</div>').appendTo($matrixmateButtonsContainer);
            const $collapsedMenu = $('<div class="menu matrixmate-collapsed-menu" />').appendTo($matrixmateButtonsContainer);

            // Create button groups
            let c = 0;
            const hiddenTypes = this.config.hiddenTypes || [];
            const usedTypes = [];

            for (let i = 0; i < groupsConfig.length; i++) {

                // Get group label
                const label = groupsConfig[i]['label'] || null;
                if (!label) {
                    continue;
                }

                // Get types for this group
                const types = (groupsConfig[i]['types'] || []).filter(typeHandle => hiddenTypes.indexOf(typeHandle) === -1);
                if (!types.length) {
                    continue;
                }

                const $mainMenuBtn = $('<div class="btn menubtn" tabindex="0">' + label + '</div>').appendTo($matrixmateButtons);
                $mainMenuBtn.addClass('dashed');

                const $mainMenu = $('<div class="menu matrixmate-menu" data-matrixmate-group="' + label + '" />').appendTo($matrixmateButtons);
                const $mainUl = $('<ul />').appendTo($mainMenu);

                if (c > 0) {
                    $('<hr/>').appendTo($collapsedMenu);
                }

                $('<h6>' + label + '</h6>').appendTo($collapsedMenu);
                const $collapsedUl = $('<ul/>').appendTo($collapsedMenu);

                // Create the type buttons inside the groups
                for (let j = 0; j < types.length; ++j) {

                    const type = types[j];
                    usedTypes.push(type);

                    const $origTypeBtn = $origButtons.find('.btn[data-type="' + type + '"]');
                    if (!$origTypeBtn.length) {
                        continue;
                    }

                    // Check if the type should be disabled
                    const typeConfig = this.getTypeConfig(type) || {};
                    const disable = typeConfig && typeConfig.maxLimit && this.countBlockByType(type) >= typeConfig.maxLimit;

                    const $li = $('<li/>');
                    const $a = $('<a/>').attr('data-type', type).text($origTypeBtn.text());
                    if (disable) {
                        $a.addClass('disabled matrixmate-disabled');
                    }

                    $li.append($a).appendTo($mainUl);
                    $li.clone().appendTo($collapsedUl);

                }

                c++;

            }

            // Create vanilla buttons for ungrouped types
            const hideUngrouped = !!this.config.hideUngroupedTypes;
            if (!hideUngrouped) {

                // Get ungrouped, original buttons
                let $hiddenUngroupedOrigButtons = $($origButtons.find('.btn[data-type]').filter(function (index, button) {
                    const type = $(button).data('type');
                    return type && hiddenTypes.indexOf(type) === -1 && usedTypes.indexOf(type) === -1;
                }).get().reverse());

                if ($hiddenUngroupedOrigButtons.length) {
                    const ungroupedTypesPosition = this.config.ungroupedTypesPosition || 'before';
                    const $ul = $('<ul />');
                    if (ungroupedTypesPosition === 'after') {
                        $hiddenUngroupedOrigButtons = $($hiddenUngroupedOrigButtons.get().reverse());
                    }
                    $hiddenUngroupedOrigButtons.each(function (index) {
                        const $btn = $(this).clone();
                        if (ungroupedTypesPosition === 'after') {
                            if (!index) {
                                $btn.addClass('icon add');
                            }
                            $matrixmateButtons.append($btn);
                        } else {
                            if (index === $hiddenUngroupedOrigButtons.length - 1) {
                                $btn.addClass('icon add');
                            }
                            $matrixmateButtons.prepend($btn);
                        }
                        const type = $btn.data('type');
                        const $li = $('<li/>');
                        const $a = $('<a/>').attr('data-type', type).text($btn.text());
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
                        const type = $(option).data('type');
                        $origButtons.find('[data-type="' + type + '"]').trigger('click');
                    }
                });

            });

            // Init menu buttons for the collapsed menu
            new Garnish.MenuBtn($collapsedButtons, {
                onOptionSelect: function (option) {
                    const type = $(option).data('type');
                    $origButtons.find('[data-type="' + type + '"]').trigger('click');
                }
            });

            this.addListener(this.$field, 'resize', () => {
                if (!this.$field.data('matrixmate-buttons-width')) {
                    this.$field.data('matrixmate-buttons-width', $matrixmateButtons.width());
                    if (!this.$field.data('matrixmate-buttons-width')) {
                        return;
                    }
                }
                if (this.$field.width() < this.$field.data('matrixmate-buttons-width')) {
                    $collapsedButtons.removeClass('hidden');
                    $matrixmateButtons.addClass('hidden');
                } else {
                    $collapsedButtons.addClass('hidden');
                    $matrixmateButtons.removeClass('hidden');
                }
            });

        },
        hideBlockTypes() {
            const hiddenTypes = this.config.hiddenTypes || [];
            if (!hiddenTypes.length) {
                return;
            }

            const $matrixButtons = this.$field.find('> .buttons').first();
            if (!$matrixButtons.length) {
                return;
            }

            const $buttonsToHide = $matrixButtons.find('.btn[data-type]').filter(function () {
                const type = $(this).data('type');
                return type && hiddenTypes.indexOf(type) > -1;
            });

            $buttonsToHide.addClass('hidden');

            // Make sure the first visible type button has the + icons
            $matrixButtons.find('.btn.add.icon').removeClass('add icon');
            $matrixButtons.find('.btn[data-type]:visible').first().addClass('add icon');

            // Also hide from the collapsed menu
            const $menuBtn = this.$field.find('> .buttons').first().find('.btn.menubtn');
            const collapsedMenu = $menuBtn.length ? ($menuBtn.data('menubtn') || {}).menu || null : null;
            const $collapsedMenuContainer = collapsedMenu ? collapsedMenu.$container || null : null;
            if ($collapsedMenuContainer) {
                $collapsedMenuContainer.find('a[data-type]').each(function () {
                    const type = $(this).data('type');
                    if (hiddenTypes.indexOf(type) > -1) {
                        $(this).parent('li').addClass('hidden');
                    }
                });
            }
        },
        initBlocks() {
            this.$field.data('matrix').$blockContainer.children().each((index, block) => {
                this.initBlock($(block));
            });
        },
        initBlock($block) {
            if ($block.data('matrixmate_inited')) {
                return;
            }
            $block.data('matrixmate_inited', true);
            this.initBlockSettingsMenu($block);
            this.initBlockTabs($block);
        },
        initBlockSettingsMenu($block, time) {

            if (!time) {
                time = new Date().getTime();
            }

            Garnish.requestAnimationFrame(() => {

                const $settingsBtn = $block.find('.actions .settings.menubtn');
                const menuBtn = $settingsBtn.length ? ($settingsBtn.data('trigger') || $settingsBtn.data('menubtn') || null) : null;

                if (!menuBtn) {
                    if ((new Date().getTime()) - time < 1000) { // Give it a second
                        this.initBlockSettingsMenu($block, time);
                    }
                    return;
                }

                const $menu = menuBtn.$container || menuBtn.menu.$container || null;
                if (!$menu.length) {
                    return;
                }

                $menu
                    .addClass('matrixmate-settings-menu')
                    .find('a[data-action="add"]')
                    .parents('li')
                    .addClass('hidden');

                $menu.find('hr').removeClass('padded');

                const $origUl = $menu.find('a[data-action="add"]').parents('li').parent('ul');
                const groupsConfig = this.config.groups || null;
                const hiddenTypes = this.config.hiddenTypes || [];

                // Create groups
                const usedTypes = [];
                if (groupsConfig) {
                    let c = 0;
                    for (let i = 0; i < groupsConfig.length; i++) {

                        const label = groupsConfig[i]['label'] || null;
                        if (!label) {
                            continue;
                        }

                        // Get the types; excluding any that are explictly hidden
                        const types = (groupsConfig[i]['types'] || []).filter(type => hiddenTypes.indexOf(type) === -1);
                        if (!types.length) {
                            continue;
                        }

                        const $newUl = $('<ul class="padded" data-matrixmate-group="' + label + '" />');
                        if (c > 0) {
                            $('<hr/>').insertBefore($origUl);
                        }

                        $('<h6>' + label + '</h6>').insertBefore($origUl);
                        $newUl.insertBefore($origUl);

                        // Create type buttons
                        for (let j = 0; j < types.length; ++j) {
                            const type = types[j];
                            usedTypes.push(type);
                            let $li = $menu.find('a[data-type="' + type + '"]').parents('li').first();
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
                const hasGroupConfig = !!(this.config['groups'] || null);
                const hideUngrouped = !!(this.config.hideUngroupedTypes || null);
                const lis = [];
                $menu.find('li.hidden a[data-action="add"]').each(function () {
                    const $a = $(this);
                    const type = $a.data('type');
                    if (usedTypes.indexOf(type) === -1 && (!hideUngrouped || !hasGroupConfig) && hiddenTypes.indexOf(type) === -1) {
                        lis.push($a.parent('li').clone().removeClass('hidden'));
                    }
                });
                if (lis.length) {
                    const $ul = $('<ul data-matrixmate-group class="padded"/>');
                    $ul.append(lis);
                    const $customHeading = $menu.find('h6').first();
                    if ($customHeading.length) {
                        $customHeading.before($ul);
                        $ul.after('<hr />');
                    } else {
                        $menu.append($ul);
                    }
                }

                $menu.on('click', '[data-matrixmate-group] a[data-action="add"]', function (e) {
                    e.preventDefault();
                    const type = $(this).data('type');
                    if (!type) {
                        return;
                    }
                    $menu.find('ul:not([data-matrixmate-group]) a[data-action="add"][data-type="' + type + '"]').trigger('click');
                });

            });

        },
        initBlockTabs($block) {

            if ($block.hasClass('matrixmate-block-inited')) {
                return;
            }

            $block.addClass('matrixmate-block-inited');

            const type = $block.data('type');
            const typeConfig = this.getTypeConfig(type);

            if (!typeConfig) {
                return;
            }

            const tabs = [].concat(typeConfig.tabs || []);
            const numTabs = tabs.length;

            // If we have any hidden fields, we'll stick them in a hidden tab
            const hiddenFields = typeConfig['hiddenFields'] || [];
            if (hiddenFields.length) {
                tabs.unshift({
                    fields: hiddenFields,
                    render: false
                });
            }

            if (!tabs.length) {
                return;
            }

            const renderDefaultTab = !!(typeConfig['defaultTabName'] || null) || (!numTabs && hiddenFields.length);

            const defaultTabOptions = {
                label: typeConfig['defaultTabName'] || Craft.t('site', 'Fields'),
                isDefaultTab: true,
                render: renderDefaultTab
            };

            if (typeConfig['defaultTabFirst']) {
                tabs.unshift(defaultTabOptions);
            } else {
                tabs.push(defaultTabOptions);
            }

            const namespace = this.$field.prop('id') + '-' + $block.data('id');
            const matrixmateNamespace = 'matrixmate-' + namespace;
            const $tabs = $('<ul class="matrixmate-tabs"/>').appendTo($block);
            const $fields = $block.find('> .fields > .flex-fields');

            $fields.addClass('matrixmate-fields').removeClass('flex-fields');

            // Create tabs
            const usedFields = [];
            let tabIndex = 0;
            let hasRenderedSelectedTab = false;

            const blockColor = $block.css('backgroundColor');

            // Get list of config tab fields
            const tabFields = tabs.reduce(function (fields, group) {
                return group['fields'] ? fields.concat(group['fields']) : fields;
            }, []);

            for (let i = 0; i < tabs.length; i++) {

                let navClasses = '';
                let paneClasses = '';

                const $pane = $('<div id="' + matrixmateNamespace + '-pane-' + i + '" class="flex-fields" />');
                const tabFieldHandles = tabs[i]['fields'] || [];

                $fields.find('> .field').each((index, field) => {
                    const $field = $(field);
                    const handle = this.getBlockFieldHandle($field);
                    if (!handle || usedFields.indexOf(handle) > -1) {
                        return;
                    }
                    if (!tabs[i].isDefaultTab && tabFieldHandles.indexOf(handle) === -1) {
                        return;
                    }
                    if (tabs[i].isDefaultTab && tabFields.indexOf(handle) > -1) {
                        return;
                    }
                    usedFields.push(handle);
                    $pane.append($field.attr('data-matrixmate-field', true));
                });

                if (!$pane.find('[data-matrixmate-field]').length) {
                    continue;
                }

                if (tabs[i]['render'] !== false && !hasRenderedSelectedTab) {
                    hasRenderedSelectedTab = true;
                    navClasses = ' sel';
                } else {
                    paneClasses = ' hidden';
                }

                $pane.addClass(paneClasses).appendTo($fields);

                if (tabs[i]['render'] !== false) {
                    const $tabLi = $('<li/>').appendTo($tabs);
                    const $tabA = $('<a id="' + matrixmateNamespace + '-' + i + '" class="tab' + navClasses + '">' + tabs[i].label + '</a>')
                        .appendTo($tabLi)
                        .data('matrixmate-tabtarget', '#' + matrixmateNamespace + '-pane-' + i);
                    if ($pane.find('.field.has-errors').length > 0) {
                        $tabA.addClass('error');
                        $tabA.append(' <span data-icon="alert" />');
                    }
                }

                tabIndex++;

            }

            if ($tabs.children().length <= 1) {
                $tabs.hide();
            }

            $tabs.find('a').css({
                backgroundColor: blockColor
            });

            $block.addClass('matrixmate-has-tabs');

            this.addListener($tabs.find('a'), 'click', 'onBlockTabClick');

            // If there are tabs with errors, set the first one to active
            const $firstTabWithError = $block.find('a.tab.error').eq(0);
            if ($firstTabWithError.length) {
                this.setBlockTabToActive($firstTabWithError);
            }

        },
        maybeDisableBlockTypes() {
            const types = Object.keys(this.config.types || {});
            for (let i = 0; i < types.length; ++i) {
                this.maybeDisableBlockType(types[i]);
            }
        },
        maybeDisableBlockType(type) {
            const typeConfig = this.getTypeConfig(type) || {};
            const maxLimit = typeConfig.maxLimit || null;

            if (!maxLimit) {
                return;
            }

            const currentCount = this.countBlockByType(type);
            const disable = currentCount >= maxLimit;

            // Update Add buttons
            this.$field.find('> .buttons .btn[data-type="' + type + '"], > .matrixmate-buttons .btn[data-type="' + type + '"]').each(function () {
                if (disable) {
                    $(this).addClass('disabled matrixmate-disabled');
                } else {
                    $(this).removeClass('disabled matrixmate-disabled');
                }
            });

            // Update Add buttons in Garnish menus
            this.$field.find('> .buttons .btn.add.menubtn, > .matrixmate-buttons .btn.menubtn, .matrixblock .settings.menubtn').each(function () {
                const menuBtn = $(this).data('trigger') || $(this).data('menubtn');
                if (!menuBtn) {
                    return;
                }
                const $container = menuBtn.$container || menuBtn.menu.$container || null;
                if (!$container) {
                    return;
                }
                $container.find('a[data-type="' + type + '"]').each(function () {
                    if (disable) {
                        $(this).addClass('disabled matrixmate-disabled');
                    } else {
                        $(this).removeClass('disabled matrixmate-disabled');
                    }
                });
            });
        },
        getTypeConfig(type) {
            return (this.config.types || {})[type] || null;
        },
        countBlockByType(type) {
            return this.$field.find('.matrixblock[data-type="' + type + '"]').length;
        },
        getBlockFieldHandle: $blockField => $blockField.attr('id').split('-').reverse()[1] || null,
        setBlockTabToActive($tab) {
            const $tabsContainer = $tab.parent().parent('.matrixmate-tabs');
            const targetSelector = $tab.data('matrixmate-tabtarget');
            if (!$tabsContainer.length || !targetSelector) {
                return;
            }
            const $target = $(targetSelector);
            if (!$target.length) {
                return;
            }
            $tabsContainer.find('a.sel').removeClass('sel');
            $tab.addClass('sel');
            $target.siblings('div').addClass('hidden');
            $target.removeClass('hidden');
        },
        onBlockTabClick(e) {
            e.preventDefault();
            e.stopPropagation();
            this.setBlockTabToActive($(e.target));
        }
    });

    const elementEditorInitFn = Craft.ElementEditor.prototype.init;
    Craft.ElementEditor.prototype.init = function () {
        elementEditorInitFn.apply(this, arguments);
        this.$container.data('matrixMateContext', Craft.MatrixMate.getContextForElement(this.settings.draftId || this.settings.canonicalId));
        Craft.MatrixMate.maybeOverrideInitialSerializedForm(this.$container);
    };

    // Override the native MatrixInput::updateAddBlockBtn method
    var updateAddBlockBtnFn = Craft.MatrixInput.prototype.updateAddBlockBtn;
    Craft.MatrixInput.prototype.updateAddBlockBtn = function () {
        updateAddBlockBtnFn.apply(this, arguments);
        const matrixMate = this.$container.data(MATRIX_MATE_KEY);
        if (matrixMate) {
            Garnish.requestAnimationFrame(() => {
                matrixMate.maybeDisableBlockTypes();
            });
        }
    }

    Garnish.on(Craft.MatrixInput, 'afterInit', e => {
        setTimeout(() => {
            const $field = e.target.$container;
            if (!$field.data(MATRIX_MATE_KEY)) {
                new Craft.MatrixMateField(e.target.$container);
            }
        }, 0);
    });

    Garnish.on(Craft.MatrixInput, 'blockAdded', e => {
        const $block = e.$block;
        const $field = $block.closest('.matrix-field');
        if (!$field.length) {
            return;
        }
        const matrixMate = $field.data(MATRIX_MATE_KEY);
        if (matrixMate) {
            matrixMate.initBlock($block);
        }
    });

    // Update forms' entry type context if the entry type changes
    $('body').on('change', 'select[id$="entryType"]', e => {
        const typeId = parseInt($(e.target).val(), 10);
        if (!typeId) {
            return;
        }
        const $form = $(e.target).closest('form');
        if (!$form.length) {
            return;
        }
        $form.data('matrixMateContext', `entryType:${typeId}`);
    });

})(jQuery);
