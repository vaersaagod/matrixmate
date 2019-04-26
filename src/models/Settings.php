<?php
/**
 * MatrixMate plugin for Craft CMS 3.x
 *
 * Welding Matrix into shape, mate!
 *
 * @link      https://vaersaagod.no
 * @copyright Copyright (c) 2019 Værsågod
 */

namespace vaersaagod\matrixmate\models;

use craft\base\Model;

/**
 * @author    Værsågod
 * @package   MatrixMate
 * @since     1.0.0
 */
class Settings extends Model
{
    /**
     * @var array|null Field configuration map
     */
    public $fields = null;
}
