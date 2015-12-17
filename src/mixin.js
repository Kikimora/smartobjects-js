export default function mixin($mixin) {
    return function (constructor, ...rest) {
        let extendee = constructor.prototype;
        let _super = Object.create(Object.getPrototypeOf(extendee));
        for (let i of Object.getOwnPropertyNames(extendee)) {
            Object.defineProperty(_super, i, Object.getOwnPropertyDescriptor(extendee, i));
        }
        let mixin = $mixin.call(constructor, _super, ...rest);
        for (let i in mixin) {
            if (mixin.hasOwnProperty(i)) {
                let descriptor = Object.getOwnPropertyDescriptor(mixin, i);
                Object.defineProperty(extendee, i, descriptor);
            }
        }

        return extendee;
    }
}

//Copied from Babel runtime
//Traverse prototype chain and get property value with given context
mixin.get = function (prototype, propertyName, context) {
    var _again = true;
    _function: while (_again) {
        var object = prototype, property = propertyName, receiver = context;
        _again = false;
        if (object === null)
            object = Function.prototype;
        var desc = Object.getOwnPropertyDescriptor(object, property);
        if (desc === undefined) {
            var parent = Object.getPrototypeOf(object);
            if (parent === null) {
                return undefined;
            } else {
                prototype = parent;
                propertyName = property;
                context = receiver;
                _again = true;
                desc = parent = undefined;
                continue _function;
            }
        } else if ('value' in desc) {
            return desc.value;
        } else {
            var getter = desc.get;
            if (getter === undefined) {
                return undefined;
            }
            return getter.call(receiver);
        }
    }
}