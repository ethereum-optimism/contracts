// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;

/**
 * @title iOVM_DeployerWhitelist
 */
interface iOVM_DeployerWhitelist {

    /********************
     * Public Functions *
     ********************/

    /**
     * Initializes the whitelist.
     * @param _owner Address of the owner for this contract.
     * @param _allowArbitraryDeployment Whether or not to allow arbitrary contract deployment.
     */
    function initialize(
        address _owner,
        bool _allowArbitraryDeployment
    )
        external;

    /**
     * Gets the owner of the whitelist.
     */
    function getOwner()
        external
        returns (
            address
        );

    /**
     * Adds or removes an address from the deployment whitelist.
     * @param _deployer Address to update permissions for.
     * @param _isWhitelisted Whether or not the address is whitelisted.
     */
    function setWhitelistedDeployer(
        address _deployer,
        bool _isWhitelisted
    )
        external;

    /**
     * Updates the owner of this contract.
     * @param _owner Address of the new owner.
     */
    function setOwner(
        address _owner
    )
        external;

    /**
     * Updates the arbitrary deployment flag.
     * @param _allowArbitraryDeployment Whether or not to allow arbitrary contract deployment.
     */
    function setAllowArbitraryDeployment(
        bool _allowArbitraryDeployment
    )
        external;

    /**
     * Permanently enables arbitrary contract deployment and deletes the owner.
     */
    function enableArbitraryContractDeployment()
        external;

    /**
     * Checks whether an address is allowed to deploy contracts.
     * @param _deployer Address to check.
     * @return Whether or not the address can deploy contracts.
     */
    function isDeployerAllowed(
        address _deployer
    )
        external
        returns (
            bool
        );
}
