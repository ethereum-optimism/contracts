pragma solidity >=0.7.0;
pragma experimental ABIEncoderV2;

import {console} from "@nomiclabs/buidler/console.sol";

interface Helper_CodeContractDataTypes {
    struct CALLResponse {
        bool success;
        bytes data;
    }
}


contract Helper_CodeContractForCalls is Helper_CodeContractDataTypes {
    bytes constant sampleCREATEData = abi.encodeWithSignature("ovmCREATE(bytes)", hex"");
    bytes constant sampleCREATE2Data = abi.encodeWithSignature("ovmCREATE2(bytes,bytes32)", hex"", 0x4242424242424242424242424242424242424242424242424242424242424242);

    function runSteps(
        bytes[] memory callsToEM,
        bool _shouldRevert,
        address _createEMResponsesStorer
    ) public returns(CALLResponse[] memory) {
        console.log("in runSteps()");
        uint numSteps = callsToEM.length;
        CALLResponse[] memory EMResponses = new CALLResponse[](numSteps);
        for (uint i = 0; i < numSteps; i++) {
            bytes memory dataToSend = callsToEM[i];
            (bool success, bytes memory responseData) = address(msg.sender).call(dataToSend);
            console.log("step to EM had result:");
            console.logBool(success);
            EMResponses[i].success = success;
            if (_isOVMCreateCall(dataToSend)) {
                console.log("above was a create-type call.  doing retrieval.");
                // console.logBytes(dataToSend);
                // console.log("storer address is:");
                // console.logAddress(_createEMResponsesStorer);
                EMResponses[i].data = abi.encode(
                    responseData,
                    _getStoredEMREsponsesInCreate(_createEMResponsesStorer)
                );
            } else {
                console.log("above was not a create-type call.");
                EMResponses[i].data = responseData;
            }
        }
        return EMResponses;
    }

    function _getStoredEMREsponsesInCreate(address _createEMResponsesStorer) internal returns(bytes memory) {
        console.log("runSteps is attempting to retrieve CREATE results using storer address of ");
        console.logAddress(_createEMResponsesStorer);
        (bool success, bytes memory data) = _createEMResponsesStorer.call(abi.encodeWithSignature("getLastResponses()"));
        console.log("call to retrieval had result:");
        console.logBool(success);
        console.log("with data:");
        console.logBytes(data);
        return data;
    }

    function _isOVMCreateCall(bytes memory _calldata) public returns(bool) {
        return (
            _doMethodIdsMatch(_calldata, sampleCREATEData) || _doMethodIdsMatch(_calldata, sampleCREATE2Data)
        );
    }

    function _doMethodIdsMatch(bytes memory _calldata1, bytes memory _calldata2) internal returns(bool) {
        return (
            _calldata1[0] == _calldata2[0] &&
            _calldata1[1] == _calldata2[1] &&
            _calldata1[2] == _calldata2[2] &&
            _calldata1[3] == _calldata2[3]            
        );
    }
}

contract Helper_CodeContractForCreates is Helper_CodeContractForCalls {
    constructor(
        bytes[] memory callsToEM,
        bool _shouldRevert,
        bytes memory _codeToDeploy,
        address _createEMResponsesStorer
    ) {  
        console.log("in constructor");
        CALLResponse[] memory responses = runSteps(callsToEM, _shouldRevert, _createEMResponsesStorer);
        Helper_CreateEMResponsesStorer(_createEMResponsesStorer).store(responses);
        uint lengthToDeploy = _codeToDeploy.length;
        // todo  revert if _shouldrevert
        assembly {
            return(add(_codeToDeploy, 0x20), lengthToDeploy)
        }
    }
}

contract Helper_CreateEMResponsesStorer is Helper_CodeContractDataTypes {
    CALLResponse[] responses;

    constructor() {
        console.log("can log in constructor");
        console.logAddress(address(this));
    }

    function store(
        CALLResponse[] memory _responses
    ) public {
        console.log("helper is storing responses...");
        for (uint i = 0; i < _responses.length; i++) {
            responses.push();
            responses[i] = _responses[i];
        }
        console.log("helper is successfully stored this many responses:");
        console.logUint(responses.length);
        console.log("first memory response is:");
        console.logBytes(_responses[0].data);
        console.log("first stored response is:");
        console.logBytes(responses[0].data);
    }

    function getLastResponses() public returns(CALLResponse[] memory) {
        console.log("helper is retreiving last stored responses.  It has this many responses stored:");
        console.logUint(responses.length);

        CALLResponse[] memory toReturn = responses;
        delete responses;
        return toReturn;
    }
}