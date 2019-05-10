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

use craft\services\Fields;
use craft\services\Sections;
use craft\web\Application;
use vaersaagod\matrixmate\assetbundles\matrixmate\MatrixMateAsset;
use vaersaagod\matrixmate\services\MatrixMateService;
use vaersaagod\matrixmate\models\Settings;

use Craft;
use craft\base\Plugin;
use craft\helpers\Json;
use craft\services\Plugins;
use craft\events\PluginEvent;
use craft\web\UrlManager;
use craft\events\RegisterUrlRulesEvent;

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
    public function onAfterInit()
    {

        $request = Craft::$app->getRequest();

        if (!$this->isInstalled || !$request->getIsCpRequest() || $request->getAcceptsJson() || $request->getIsConsoleRequest() || !Craft::$app->getUser()->checkPermission('accessCp')) {
            return;
        }

        // Get the field config
        $fieldConfig = MatrixMate::$plugin->matrixMate->getFieldConfig();
        if (!$fieldConfig) {
            return;
        }

        // Get context
        $context = '*';
        $isEntryVersion = false;

        $segments = $request->getSegments();
        if (empty($segments)) {
            return;
        }

        if (\count($segments) >= 3 && $segments[0] === 'entries') {
            $entryType = null;
            if ($segments[2] === 'new') {
                if ($section = Craft::$app->getSections()->getSectionByHandle($segments[1])) {
                    $entryType = $section->getEntryTypes()[0] ?? null;
                }
            } else {
                $entryId = (int)\explode('-', $segments[2])[0];
                if ($entryId && $entry = Craft::$app->getEntries()->getEntryById($entryId)) {
                    $entryType = $entry->getType();
                }
            }
            if ($entryType) {
                $context = "entryType:{$entryType->id}";
            }
            if (($segments[3] ?? null) === 'versions') {
                $isEntryVersion = true;
            }
        } else if (\count($segments) >= 3 && $segments[0] === 'categories') {
            if ($group = Craft::$app->getCategories()->getGroupByHandle($segments[1])) {
                $context = "categoryGroup:{$group->handle}";
            }
        } else if (\count($segments) >= 2 && $segments[0] === 'globals') {
            if ($globalSet = Craft::$app->getGlobals()->getSetByHandle($segments[\count($segments) - 1])) {
                $context = "globalSet:{$globalSet->handle}";
            }
        } else if ($segments[0] == 'myaccount' || (\count($segments) === 2 && $segments[0] === 'users')) {
            $context = 'users';
        }

        $settings = [
            'context' => $context,
            'fieldsConfig' => $fieldConfig,
            'isEntryVersion' => $isEntryVersion,
        ];

        $view = Craft::$app->getView();
        $view->registerAssetBundle(MatrixMateAsset::class);

        $view->registerJs('new Craft.MatrixMate(' . Json::encode($settings, JSON_UNESCAPED_UNICODE) . ');');

    }

    /**
     *
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
            Application::class,
            Application::EVENT_INIT,
            [$this, 'onAfterInit']
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
    }
}
