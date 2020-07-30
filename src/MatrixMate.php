<?php
/**
 * MatrixMate plugin for Craft CMS 3.x
 *
 * Welding Matrix into shape, mate!
 *
 * @link      https://vaersaagod.no
 * @copyright Copyright (c) 2019 Værsågod
 */

namespace vaersaagod\matrixmate;

use vaersaagod\matrixmate\assetbundles\matrixmate\MatrixMateAsset;
use vaersaagod\matrixmate\services\MatrixMateService;
use vaersaagod\matrixmate\models\Settings;

use Craft;
use craft\base\Plugin;
use craft\elements\Category;
use craft\elements\GlobalSet;
use craft\events\PluginEvent;
use craft\events\RegisterUrlRulesEvent;
use craft\helpers\Json;
use craft\services\Categories;
use craft\services\Fields;
use craft\services\Globals;
use craft\services\Plugins;
use craft\services\Sections;
use craft\services\Users;
use craft\web\Application;
use craft\web\UrlManager;

use yii\base\Event;

/**
 * Class MatrixMate
 *
 * @author    Værsågod
 * @package   MatrixMate
 * @since     1.0.0
 *
 * @property  MatrixMateService $matrixMate
 */
class MatrixMate extends Plugin
{
    // Static Properties
    // =========================================================================

    /**
     * @var MatrixMate
     */
    public static $plugin;

    // Public Properties
    // =========================================================================

    /**
     * @var string
     */
    public $schemaVersion = '1.0.0';

    // Public Methods
    // =========================================================================

    /**
     * @inheritdoc
     */
    public function init()
    {
        parent::init();
        self::$plugin = $this;

        // Register services
        $this->setComponents([
            'matrixMate' => MatrixMateService::class,
        ]);

        $this->addEventListeners();

        Craft::info(
            Craft::t(
                'matrixmate',
                '{name} plugin loaded',
                ['name' => $this->name]
            ),
            __METHOD__
        );
    }

    /**
     * @throws \yii\base\InvalidConfigException
     */
    public function onAfterLoadPlugins()
    {

        $request = Craft::$app->getRequest();

        if (!$this->isInstalled || !$request->getIsCpRequest() || $request->getAcceptsJson() || $request->getIsConsoleRequest() || !Craft::$app->getUser()->checkPermission('accessCp')) {
            return;
        }

        // Get the field config
        $fieldConfig = MatrixMate::$plugin->matrixMate->getFieldConfig();
        if (!$fieldConfig) {
            // Bail early if no field config
            return;
        }

        $segments = $request->getSegments();
        if (empty($segments)) {
            return;
        }

        $context = '*';
        $isEntryVersion = false;

        if (\count($segments) >= 3 && $segments[0] === 'entries') {
            $entryType = null;
            if ($segments[2] === 'new') {
                // New entry – check if there's a (valid) typeId param in the URL
                $typeIdParam = (int)$request->getParam('typeId');
                if (!$typeIdParam || !$entryType = Craft::$app->getSections()->getEntryTypeById($typeIdParam)) {
                    // Nope, use the first one for the current section
                    $section = Craft::$app->getSections()->getSectionByHandle($segments[1]);
                    $entryType = $section ? $section->getEntryTypes()[0] : null;
                }
            } else {
                // Existing entry – get the entry and use its entry type
                $entryId = (int)\explode('-', $segments[2])[0];
                if ($entryId) {
                    $siteHandle = $request->getParam('site');
                    $site = $siteHandle ? Craft::$app->getSites()->getSiteByHandle($siteHandle) : null;
                    $siteId = $site ? $site->id : null;
                    if ($entry = Craft::$app->getEntries()->getEntryById($entryId, $siteId)) {
                        $entryType = $entry->getType();
                    }
                }
            }
            if ($entryType) {
                $context = "entryType:{$entryType->id}";
            }
            if (($segments[3] ?? null) === 'versions' || !!$request->getParam('revisionId')) {
                $isEntryVersion = true;
            }
        } else if (\count($segments) >= 3 && $segments[0] === 'categories') {
            if ($group = Craft::$app->getCategories()->getGroupByHandle($segments[1])) {
                $context = "categoryGroup:{$group->id}";
            }
        } else if (\count($segments) >= 2 && $segments[0] === 'globals') {
            if ($globalSet = Craft::$app->getGlobals()->getSetByHandle($segments[\count($segments) - 1])) {
                $context = "globalSet:{$globalSet->id}";
            }
        } else if ($segments[0] == 'myaccount' || (\count($segments) === 2 && $segments[0] === 'users')) {
            $context = 'users';
        }

        $settings = [
            'context' => $context,
            'fieldsConfig' => $fieldConfig,
            'isEntryVersion' => $isEntryVersion,
            'isCraft34' => \version_compare(Craft::$app->getVersion(), '3.4.0', '>='),
            'isCraft35' => \version_compare(Craft::$app->getVersion(), '3.5.0-RC1', '>='),
        ];

        $view = Craft::$app->getView();
        $view->registerAssetBundle(MatrixMateAsset::class);

        $view->registerJs('if (Craft && Craft.MatrixMate) { new Craft.MatrixMate(' . Json::encode($settings, JSON_UNESCAPED_UNICODE) . '); }');

    }

    /**
     *  Clear the field config cache when something field related happens
     */
    public function onAfterSaveFieldContext()
    {
        MatrixMate::$plugin->matrixMate->clearFieldConfigCache();
    }

    // Protected Methods
    // =========================================================================

    /**
     * @inheritdoc
     */
    protected function createSettingsModel()
    {
        return new Settings();
    }

    /**
     *
     */
    protected function addEventListeners()
    {
        Event::on(
            Plugins::class,
            Plugins::EVENT_AFTER_LOAD_PLUGINS,
            [$this, 'onAfterLoadPlugins']
        );

        Event::on(
            Fields::class,
            Fields::EVENT_AFTER_SAVE_FIELD_LAYOUT,
            [$this, 'onAfterSaveFieldContext']
        );

        Event::on(
            Fields::class,
            Fields::EVENT_AFTER_DELETE_FIELD,
            [$this, 'onAfterSaveFieldContext']
        );

        Event::on(
            Fields::class,
            Fields::EVENT_AFTER_SAVE_FIELD,
            [$this, 'onAfterSaveFieldContext']
        );

        Event::on(
            Sections::class,
            Sections::EVENT_AFTER_SAVE_ENTRY_TYPE,
            [$this, 'onAfterSaveFieldContext']
        );

        Event::on(
            Sections::class,
            Sections::EVENT_AFTER_SAVE_SECTION,
            [$this, 'onAfterSaveFieldContext']
        );

        Event::on(
            Categories::class,
            Categories::EVENT_AFTER_SAVE_GROUP,
            [$this, 'onAfterSaveFieldContext']
        );

        Event::on(
            Globals::class,
            Globals::EVENT_AFTER_SAVE_GLOBAL_SET,
            [$this, 'onAfterSaveFieldContext']
        );
    }
}
