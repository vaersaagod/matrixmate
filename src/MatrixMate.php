<?php
/**
 * MatrixMate plugin for Craft CMS 4.x
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
use craft\elements\db\ElementQuery;
use craft\elements\Entry;
use craft\elements\GlobalSet;
use craft\elements\User;
use craft\events\DefineHtmlEvent;
use craft\events\PopulateElementEvent;
use craft\events\TemplateEvent;
use craft\helpers\Json;
use craft\services\Fields;
use craft\web\Application;
use craft\web\Controller;

use craft\web\CpScreenResponseFormatter;
use craft\web\Request;
use craft\web\Response;
use craft\web\View;

use vaersaagod\matrixmate\assetbundles\matrixmate\MatrixMateAsset;
use vaersaagod\matrixmate\services\MatrixMateService;
use vaersaagod\matrixmate\models\Settings;

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
     * @var Settings|null
     * @see getSettings()
     */
    private ?Settings $_settings = null;

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
        $events = [
            Fields::EVENT_AFTER_SAVE_FIELD_LAYOUT => Fields::class,
            Fields::EVENT_AFTER_DELETE_FIELD_LAYOUT => Fields::class,
            Fields::EVENT_AFTER_SAVE_FIELD => Fields::class,
            Fields::EVENT_AFTER_DELETE_FIELD => Fields::class,
        ];
        foreach ($events as $event => $class) {
            Event::on($class, $event, function (): void {
                $this->matrixMate->clearFieldConfigCache();
            });
        }

        // Defer further initialisation to after plugins have loaded, and only for CP web requests
        if (Craft::$app->getRequest()->getIsCpRequest() && !Craft::$app->getRequest()->getIsConsoleRequest()) {
            Event::on(
                Application::class,
                Application::EVENT_INIT,
                function (): void {
                    $this->onAppInit();
                }
            );
        }

        Craft::info(
            Craft::t(
                'matrixmate',
                'MatrixMate plugin loaded'
            ),
            __METHOD__
        );
    }

    /**
     * @return Settings
     */
    public function getSettings(): Settings
    {
        if ($this->_settings === null) {
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
     * @return void
     */
    protected function onAppInit(): void
    {

        if (!Craft::$app->getUser()->checkPermission('accessCp')) {
            return;
        }

        // Register asset bundle for elements with a sidebar (i.e. entries, assets, categories)
        Event::on(
            Element::class,
            Element::EVENT_DEFINE_SIDEBAR_HTML,
            function (DefineHtmlEvent $event) {
                /** @var Element $element */
                $element = $event->sender;
                $this->registerAssetBundleForElement($element);
            }
        );

        // Register asset bundle for products
        $commercePlugin = Craft::$app->getPlugins()->getPlugin('commerce', false);
        if($commercePlugin && $commercePlugin->isInstalled) {
            Craft::$app->getView()->hook('cp.commerce.product.edit.content', function (array $context) {
                /** @var Element|null $element */
                $element = $context['product'] ?? null;
                $this->registerAssetBundleForElement($element);
            });
        }

        // Register asset bundle for users
        Craft::$app->getView()->hook('cp.users.edit', function (array $context) {
            /** @var Element|null $element */
            $element = $context['user'] ?? null;
            $this->registerAssetBundleForElement($element);
        });

        // Register asset bundle for global sets
        Craft::$app->getView()->hook('cp.globals.edit', function (array $context) {
            /** @var Element|null $element */
            $element = $context['globalSet'] ?? null;
            $this->registerAssetBundleForElement($element);
        });

    }

    /**
     * @param Element $element
     * @return string
     */
    protected function getContextForElement(Element $element): string
    {
        if ($element instanceof Entry) {
            $context = "entryType:$element->typeId";
        } elseif ($element instanceof Category) {
            $context = "categoryGroup:$element->groupId";
        } elseif ($element instanceof Asset) {
            $context = "volume:{$element->getVolumeId()}";
        } elseif ($element instanceof GlobalSet) {
            $context = "globalSet:$element->id";
        } elseif ($element instanceof User) {
            $context = 'users';
        } elseif ($element instanceof \craft\commerce\elements\Product) {
            $context = "productType:{$element->getType()->id}";
        } else {
            $context = '*';
        }
        return $context;
    }

    /**
     * @param Element|null $element
     * @return void
     * @throws \yii\base\InvalidConfigException
     */
    protected function registerAssetBundleForElement(?Element $element): void
    {

        if (!$element || $element->getIsRevision() || !$fieldConfig = $this->matrixMate->getFieldConfig()) {
            return;
        }

        $elementId = (int)($element->draftId ?? $element->canonicalId ?? $element->id);
        if (empty($elementId) && $element instanceof \craft\commerce\elements\Product) {
            // New Commerce products have no IDs
            $elementId = 'new-product';
        }

        if (!$elementId) {
            return;
        }

        $context = $this->getContextForElement($element);
        $configJs = Json::encode($fieldConfig, JSON_UNESCAPED_UNICODE);

        $js = <<<JS
if (Craft && Craft.MatrixMate) {
    Craft.MatrixMate.fieldConfig = $configJs;
    Craft.MatrixMate.initPrimaryForm('$elementId', '$context');
}
JS;
        Craft::$app->getView()->registerAssetBundle(MatrixMateAsset::class, \yii\web\View::POS_END);
        Craft::$app->getView()->registerJs($js, \yii\web\View::POS_END);
    }

}
