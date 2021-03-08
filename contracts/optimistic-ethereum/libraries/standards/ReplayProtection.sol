pragma solidity >=0.5.16 <0.8.0;

/* External Imports */
import "@openzeppelin/contracts/cryptography/ECDSA.sol";

contract ReplayProtection {

    /*********************
     * Replay protection *
     ********************/
    mapping(address => uint) nonce;

    /**
     * Throws if the replay protection is incorrect for the signer. 
     * It will check that the submitted nonce is greater than the nonce stored. Unlike Ethereum which requires it
     * to strictly increment by 1.
     * 
     * @param _hash Hash of message to be signed.
     * @param _nonce Replay protection nonce.
     * @param _signature Signature to verify.
     * @return Signer's address.
     */
    function checkSignatureAndReplayProtection(bytes32 _hash, uint _nonce, bytes memory _signature) internal returns(address) {
        address signer = ECDSA.recover(_hash, _signature);
        require(_nonce > nonce[signer], "Transaction already submitted by signer");
        nonce[signer] = _nonce; // Re-use storage to minimise gas cost 
        return signer;
    }
}
