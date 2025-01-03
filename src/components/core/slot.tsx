import * as React from 'react';
import { referrals } from '~/components/utils';

type ReactElementRef = { ref: React.Ref<any> };
type ReactElementProps = React.PropsWithChildren & ReactElementRef;
type ReactElement = React.ReactElement<ReactElementProps> & ReactElementRef;

export type SlotProps = React.HTMLAttributes<HTMLElement> & {
  children?: React.ReactNode;
} & React.RefAttributes<HTMLElement>;

/**
 * React Slot
 *
 * @see https://github.com/radix-ui/primitives
 */
export function Slot({ children, ref, ...slotProps }: SlotProps) {
  const childrenArray = React.Children.toArray(children);
  const slottable = childrenArray.find(isSlottable);

  if (slottable) {
    // the new element to render is the one passed as a child of `Slottable`
    const newElement = slottable.props.children as ReactElement;

    const newChildren = childrenArray.map((child) => {
      if (child === slottable) {
        // because the new element will be the one rendered, we are only interested
        // in grabbing its children (`newElement.props.children`)
        if (React.Children.count(newElement) > 1) return React.Children.only(null);
        return React.isValidElement(newElement) ? newElement.props.children : null;
      } else {
        return child;
      }
    });

    return (
      <SlotClone {...slotProps} ref={ref}>
        {React.isValidElement(newElement) ? React.cloneElement(newElement, undefined, newChildren) : null}
      </SlotClone>
    );
  }

  return (
    <SlotClone {...slotProps} ref={ref}>
      {children}
    </SlotClone>
  );
}

type SlotCloneProps = React.PropsWithChildren & React.RefAttributes<any>;
const SlotClone = ({ children, ref, ...props }: SlotCloneProps) => {
  if (React.isValidElement(children)) {
    const childrenRef = getElementRef(children as ReactElement);
    return React.cloneElement(children, {
      ...mergeProps(props, children.props as React.PropsWithChildren),
      // @ts-ignore
      ref: ref ? referrals(ref, childrenRef) : childrenRef,
    });
  }

  return React.Children.count(children) > 1 ? React.Children.only(null) : null;
};

/** Slottable */
export function Slottable({ children }: React.PropsWithChildren) {
  return <>{children}</>;
}

type AnyProps = Record<string, any>;
function isSlottable(child: React.ReactNode): child is ReactElement {
  return React.isValidElement(child) && child.type === Slottable;
}

function mergeProps(slotProps: AnyProps, childProps: AnyProps) {
  // all child props should override
  const overrideProps = { ...childProps };

  for (const propName in childProps) {
    const slotPropValue = slotProps[propName];
    const childPropValue = childProps[propName];

    const isHandler = /^on[A-Z]/.test(propName);
    if (isHandler) {
      // if the handler exists on both, we compose them
      if (slotPropValue && childPropValue) {
        overrideProps[propName] = (...args: unknown[]) => {
          childPropValue(...args);
          slotPropValue(...args);
        };
      }
      // but if it exists only on the slot, we use only this one
      else if (slotPropValue) {
        overrideProps[propName] = slotPropValue;
      }
    }
    // if it's `style`, we merge them
    else if (propName === 'style') {
      overrideProps[propName] = { ...slotPropValue, ...childPropValue };
    } else if (propName === 'className') {
      overrideProps[propName] = [slotPropValue, childPropValue].filter(Boolean).join(' ');
    }
  }

  return { ...slotProps, ...overrideProps };
}

// Before React 19 accessing `element.props.ref` will throw a warning and suggest using `element.ref`
// After React 19 accessing `element.ref` does the opposite.
// https://github.com/facebook/react/pull/28348
//
// Access the ref using the method that doesn't yield a warning.
function getElementRef(element: ReactElement) {
  // React <=18 in DEV
  let getter = Object.getOwnPropertyDescriptor(element.props, 'ref')?.get;
  let mayWarn = getter && 'isReactWarning' in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.ref;
  }

  // React 19 in DEV
  getter = Object.getOwnPropertyDescriptor(element, 'ref')?.get;
  mayWarn = getter && 'isReactWarning' in getter && getter.isReactWarning;
  if (mayWarn) {
    return element.props.ref;
  }

  // Not DEV
  return element.props.ref || element.ref;
}
