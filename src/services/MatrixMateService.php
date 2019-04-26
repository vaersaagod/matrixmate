<?php
/**
 * MatrixMate plugin for Craft CMS 3.x
 *
 * Welding Matrix into shape, mate!
 *
 * @link      https://vaersaagod.no
 * @copyright Copyright (c) 2019 Værsågod
 */

namespace vaersaagod\matrixmate\services;

use vaersaagod\matrixmate\MatrixMate;

use Craft;
use craft\base\Component;
use craft\base\Field;
use craft\fields\Matrix;
use craft\helpers\Json;
use craft\services\Content;

/**
 * @author    Værsågod
 * @package   MatrixMate
 * @since     1.0.0
 */
class MatrixMateService extends Component
{

    // Public Methods
    // =========================================================================

    /**
     * @return string
     */
    public function getFieldConfigCacheKey(): string
    {
        $configFromFile = Json::encode(Craft::$app->getConfig()->getConfigFromFile('matrixmate'));
        return 'matrixMateFieldConfig_' . \md5(MatrixMate::$plugin->getVersion() . $configFromFile);
    }

    /**
     *
     */
    public function clearFieldConfigCache()
    {
        Craft::$app->getCache()->set($this->getFieldConfigCacheKey(), null);
    }

    /*
     * @return null|array
     */
    /**
     * @return array|mixed|null
     */
    public function getFieldConfig()
    {

        $isDevMode = !!Craft::$app->getConfig()->getGeneral()->devMode;
        $cache = Craft::$app->getCache();
        $cacheKey = $this->getFieldConfigCacheKey();
        $cachedConfig = null;

        if ($isDevMode) {
            Craft::$app->getCache()->set($cacheKey, null);
        } else {
            $cachedConfig = $cache->get($cacheKey);
        }

        if ($cachedConfig) {
            return $cachedConfig;
        }

        $config = (MatrixMate::$plugin->getSettings() ?: [])['fields'] ?? null;
        if (!$config || !\is_array($config) || empty($config)) {
            return null;
        }

        $allFields = Craft::$app->getFields()->getAllFields(Craft::$app->getContent()->fieldContext);
        $matrixFieldHandles = \array_reduce($allFields, function (array $handles, Field $field) {
            if ($field instanceof Matrix) {
                $handles[] = $field->handle;
            }
            return $handles;
        }, []);

        foreach ($config as $fieldHandle => &$settings) {

            if (!\in_array($fieldHandle, $matrixFieldHandles) || !\is_array($settings)) {
                unset($config[$fieldHandle]);
                continue;
            }

            if (!empty(\array_intersect(['groups', 'types', 'hiddenTypes', 'hideUngroupedTypes', 'defaultTabName'], \array_keys($settings)))) {
                $settings = ['*' => $settings];
            }

            foreach ($settings as $contextKey => $contextSettings) {

                if (!\is_array($contextSettings)) {
                    unset($settings[$contextKey]);
                    continue;
                }

                // Groups config
                $contextSettings['groups'] = $this->getGroupsConfigFromArray($contextSettings);

                // Types config
                $contextSettings['types'] = $this->getTypesConfigFromArray($contextSettings);

                // Hide ungrouped types?
                $contextSettings['hideUngroupedTypes'] = !!($contextSettings['hideUngroupedTypes'] ?? false);

                // Explicitly hidden types
                $hiddenTypes = $contextSettings['hiddenTypes'] ?? null;
                if (\is_string($hiddenTypes)) {
                    $hiddenTypes = \explode(',', \preg_replace('/\s+/', '', $hiddenTypes));
                }
                $contextSettings['hiddenTypes'] = \is_array($hiddenTypes) && !empty($hiddenTypes) ? $hiddenTypes : null;

                $contextArray = \explode(',', \preg_replace('/\s+/', '', $contextKey));

                unset($settings[$contextKey]);

                foreach ($contextArray as $context) {

                    // Parse contexts
                    if (\strpos($context, 'entryType:') === 0) {
                        $entryTypeHandle = \explode(':', $context)[1] ?? null;
                        if ($entryTypeHandle && $entryTypes = Craft::$app->getSections()->getEntryTypesByHandle($entryTypeHandle)) {
                            foreach ($entryTypes as $entryType) {
                                $settings["entryType:{$entryType->id}"] = $contextSettings;
                            }
                            continue;
                        }
                    } else if (\strpos($context, 'section:') === 0) {
                        $sectionHandle = \explode(':', $context)[1] ?? null;
                        if ($sectionHandle && $section = Craft::$app->getSections()->getSectionByHandle($sectionHandle)) {
                            $entryTypes = $section->getEntryTypes();
                            foreach ($entryTypes as $entryType) {
                                if ($settings["entryType:{$entryType->handle}"] ?? null) {
                                    continue;
                                }
                                $settings["entryType:{$entryType->id}"] = $contextSettings;
                            }
                            continue;
                        }
                    }

                    $settings[$context] = $contextSettings;

                }

            }
        }

        if (!$isDevMode) {
            $cache->set($cacheKey, $config);
        }

        return $config;
    }

    /**
     * @param array $array
     * @return array|null
     */
    protected function getGroupsConfigFromArray(array $array)
    {
        $groups = $array['groups'] ?? null;
        if (!$groups || !\is_array($groups)) {
            return null;
        }
        foreach ($groups as $key => &$group) {
            $group = [
                'label' => Craft::t('site', $group['label'] ?? $key),
                'types' => $group['types'] ?? $group,
            ];
        }
        return \array_values($groups);
    }

    /**
     * @param array $array
     * @return mixed|null
     */
    protected function getTypesConfigFromArray(array $array)
    {
        $types = $array['types'] ?? null;
        if (!$types || !\is_array($types)) {
            return null;
        }
        foreach ($types as $typeHandle => &$typeConfig) {
            // Get default tab name
            $defaultTabName = $typeConfig['defaultTabName'] ?? $array['defaultTabName'] ?? null;
            if ((!$defaultTabName || !\is_string($defaultTabName)) && $defaultTabName !== false) {
                $defaultTabName = Craft::t('site', 'Fields');
            } else if (\is_string($defaultTabName)) {
                $defaultTabName = Craft::t('site', $defaultTabName);
            }
            // Get max limit
            $maxLimit = $typeConfig['maxLimit'] ?? null;
            if ($maxLimit !== null) {
                $maxLimit = (int)$maxLimit;
            }
            // Get tabs
            $tabs = $this->getTabsConfigFromArray($typeConfig);
            $typeConfig = [
                'tabs' => $tabs,
                'defaultTabName' => $defaultTabName,
                'maxLimit' => $maxLimit,
            ];
        }
        return $types;
    }

    /**
     * @param array $array
     * @return mixed|null
     */
    protected function getTabsConfigFromArray(array $array)
    {
        $tabs = $array['tabs'] ?? null;
        if (!$tabs || !\is_array($tabs)) {
            return null;
        }
        foreach ($tabs as $key => &$tab) {
            $tab = [
                'label' => Craft::t('site', $tab['label'] ?? $key),
                'fields' => $tab['fields'] ?? $tab,
            ];
        }
        return $tabs;
    }
}
