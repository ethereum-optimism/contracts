// TODO: clean this up and move elsewhere?
import { iAbs_BaseCrossDomainMessenger } from "../../iOVM/bridge/iAbs_BaseCrossDomainMessenger.sol";
import "hardhat/console.sol";

contract OVM_CrossChainEnabled {
    iAbs_BaseCrossDomainMessenger messenger;

    modifier onlyFromCrossChainContract(
        address _accountOnOtherChain
    ) {
        require(
            msg.sender == address(messenger),
            "OVM_XCHAIN: messenger contract unauthenticated"
        );

        require(
            messenger.xDomainMessageSender() == _accountOnOtherChain,
            "OVM_XCHAIN: wrong sender of cross-domain message"
        );        
        _;
    }
    
    constructor(
        iAbs_BaseCrossDomainMessenger _messenger
    ) public {
        messenger = _messenger;
    }

    function sendCrossDomainMessage(
        address _crossDomainTarget,
        bytes memory _data,
        uint32 _gasLimit
    ) internal {
        console.log("sending message to ");
        console.logAddress(address(messenger));
        messenger.sendMessage(_crossDomainTarget, _data, _gasLimit);
        console.log("sendmessage successful");
    }
}