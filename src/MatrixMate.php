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

use Craft;
use craft\base\Element;
use craft\base\Plugin;
use craft\elements\Asset;
use craft\elements\Category;
use craft\elements\Entry;
use craft\elements\GlobalSet;
use craft\elements\User;
use craft\helpers\Json;
use craft\services\Fields;
use craft\services\Plugins;
use craft\web\Controller;

use vaersaagod\matrixmate\assetbundles\matrixmate\MatrixMateAsset;
use vaersaagod\matrixmate\services\MatrixMateService;
use vaersaagod\matrixmate\models\Settings;

use yii\base\Action;
use yii\base\ActionEvent;
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

    /**
     * @var Settings
     * @see getSettings()
     */
    private $_settings;

    /**
     * @inheritdoc
     */
    public function init()
    {

        parent::init();

        if (!$this->isInstalled) {
            return;
        }

        // Register services
        $this->setComponents([
            'matrixMate' => MatrixMateService::class,
        ]);

        // Clear the field config cache when something field related happens
        foreach ([
             Fields::EVENT_AFTER_SAVE_FIELD_LAYOUT => Fields::class,
             Fields::EVENT_AFTER_DELETE_FIELD_LAYOUT => Fields::class,
             Fields::EVENT_AFTER_SAVE_FIELD => Fields::class,
             Fields::EVENT_AFTER_DELETE_FIELD => Fields::class,
        ] as $event => $class) {
            Event::on($class, $event, [$this->matrixMate, 'clearFieldConfigCache']);
        }

        // Defer further initialisation to after plugins have loaded, and only for CP web requests
        if (Craft::$app->getRequest()->getIsCpRequest() && !Craft::$app->getRequest()->getIsConsoleRequest()) {
            Event::on(
                Plugins::class,
                Plugins::EVENT_AFTER_LOAD_PLUGINS,
                [$this, 'onAfterLoadPlugins']
            );
        }

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
     * @return void
     */
    public function onAfterLoadPlugins(): void
    {

        if (!Craft::$app->getUser()->checkPermission('accessCp')) {
            return;
        }

        // Entries, assets and categories
        Craft::$app->getView()->hook('cp.elements.edit', function (array $context) {
            $this->registerAssetBundleForElement($context['element'] ?? null);
        });

        // Users
        Craft::$app->getView()->hook('cp.users.edit', function (array $context) {
            $this->registerAssetBundleForElement($context['user'] ?? null);
        });

        // Global sets
        Craft::$app->getView()->hook('cp.globals.edit', function (array $context) {
            $this->registerAssetBundleForElement($context['globalSet'] ?? null);
        });

        // Slideouts
        Event::on(
            Controller::class,
            \yii\base\Controller::EVENT_BEFORE_ACTION,
            function (ActionEvent $event) {
                $action = $event->action;
                if (!$action instanceof Action || $action->id !== 'get-editor-html') {
                    return;
                }
                $request = $action->controller->request;
                $elementId = (int)$request->getBodyParam('elementId');
                $elementType = $request->getBodyParam('elementType');
                $siteId = (int)$request->getBodyParam('siteId');
                if ($elementId && $elementType && $siteId) {
                    $element = Craft::$app->getElements()->getElementById($elementId, $elementType, $siteId);
                    $this->registerAssetBundleForElement($element);
                }
            }
        );

    }

    /**
     * @return Settings
     */
    public function getSettings(): Settings
    {
        if (!isset($this->_settings)) {
            $this->_settings = $this->createSettingsModel();
        }
        return $this->_settings;
    }

    // Protected Methods
    // =========================================================================

    /**
     * @return Settings
     */
    protected function createSettingsModel(): Settings
    {
        return new Settings();
    }

    /**
     * @param Element|null $element
     * @return void
     * @throws \yii\base\InvalidConfigException
     */
    protected function registerAssetBundleForElement(?Element $element): void
    {
        if (!$element || !$fieldsConfig = MatrixMate::getInstance()->matrixMate->getFieldConfig()) {
            return;
        }

        $context = '*';

        if ($element instanceof Entry) {
            $context = "entryType:$element->typeId";
        } else if ($element instanceof Category) {
            $context = "categoryGroup:$element->groupId";
        } else if ($element instanceof Asset) {
            $context = "volume:$element->volumeId";
        } else if ($element instanceof GlobalSet) {
            $context = "globalSet:$element->handle";
        } else if ($element instanceof User) {
            $context = 'users';
        }

        $settings = [
            'context' => $context,
            'fieldsConfig' => $fieldsConfig,
            'isRevision' => (bool)$element->revisionId,
        ];

        Craft::$app->getView()->registerAssetBundle(MatrixMateAsset::class, \yii\web\View::POS_END);
        Craft::$app->getView()->registerJs('if (Craft && Craft.MatrixMate) { new Craft.MatrixMate(' . Json::encode($settings, JSON_UNESCAPED_UNICODE) . '); }', \yii\web\View::POS_END);
    }

}
