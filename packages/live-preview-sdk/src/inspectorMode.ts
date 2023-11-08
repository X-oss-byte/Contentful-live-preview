import { getAllTaggedElements, getTaggedInformation } from './fieldTaggingUtils';
import { sendMessageToEditor } from './helpers';
import {
  InspectorModeChangedMessage,
  LivePreviewPostMessageMethods,
  MessageFromEditor,
  InteractionEventMethods,
} from './messages';

export class InspectorMode {
  private defaultLocale: string;
  private targetOrigin: string[];
  private isScrolling: boolean = false;
  private isResizing: boolean = false;
  private scrollTimeout?: NodeJS.Timeout;
  private resizeTimeout?: NodeJS.Timeout;
  private hoveredElement?: HTMLElement;

  constructor({ locale, targetOrigin }: { locale: string; targetOrigin: string[] }) {
    this.defaultLocale = locale;
    this.targetOrigin = targetOrigin;

    // TODO: we we need this?
    this.onMouseOver = this.onMouseOver.bind(this);
    this.onScroll = this.onScroll.bind(this);
    this.onResize = this.onResize.bind(this);
    this.handleElementInteraction = this.handleElementInteraction.bind(this);
    this.sendAllElements = this.sendAllElements.bind(this);

    // TODO: on resize do the something similar as onScroll
    window.addEventListener('scroll', this.onScroll);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('mouseover', this.onMouseOver);
  }

  // Handles incoming messages from Contentful
  public receiveMessage(data: MessageFromEditor): void {
    if (data.method === LivePreviewPostMessageMethods.INSPECTOR_MODE_CHANGED) {
      const { isInspectorActive } = data as InspectorModeChangedMessage;
      // Toggle the contentful-inspector--active class on the body element based on the isInspectorActive boolean
      document.body.classList.toggle('contentful-inspector--active', isInspectorActive);

      if (isInspectorActive) {
        this.sendAllElements();
      }
    }
  }

  // TODO: onResize and onScroll are quite similar, can we use a factory to set it up
  private onResize() {
    if (!this.isResizing) {
      this.isScrolling = true;
      sendMessageToEditor(InteractionEventMethods.RESIZE_START, {} as any, this.targetOrigin);
    }

    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    this.resizeTimeout = setTimeout(() => {
      // No longer resizing, let's update everything
      this.isScrolling = false;
      sendMessageToEditor(InteractionEventMethods.RESIZE_END, {} as any, this.targetOrigin);
      this.sendAllElements();
      if (this.hoveredElement) {
        this.handleElementInteraction(this.hoveredElement);
      }
    }, 150);
  }

  private onScroll() {
    if (!this.isScrolling) {
      this.isScrolling = true;
      sendMessageToEditor(InteractionEventMethods.SCROLL_START, {} as any, this.targetOrigin);
    }

    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }

    this.scrollTimeout = setTimeout(() => {
      // No longer scrolling, let's update everything
      this.isScrolling = false;
      sendMessageToEditor(InteractionEventMethods.SCROLL_END, {} as any, this.targetOrigin);
      this.sendAllElements();
      if (this.hoveredElement) {
        this.handleElementInteraction(this.hoveredElement);
      }
    }, 150);
  }

  private onMouseOver(e: MouseEvent) {
    const eventTargets = e.composedPath();

    for (const eventTarget of eventTargets) {
      const element = eventTarget as HTMLElement;
      if (element.nodeName === 'BODY') break;
      if (typeof element?.getAttribute !== 'function') continue;

      if (this.handleElementInteraction(element)) {
        return;
      }
    }

    // Clear if no tagged element is hovered
    this.hoveredElement = undefined;
    sendMessageToEditor(
      InteractionEventMethods.MOUSE_MOVE,
      {
        hoveredElement: null,
        coordinates: null,
      } as any,
      this.targetOrigin
    );
  }

  private handleElementInteraction(element: HTMLElement): boolean {
    const taggedInformation = getTaggedInformation(element, this.defaultLocale);

    if (!taggedInformation) {
      return false;
    }

    this.hoveredElement = element;
    sendMessageToEditor(
      InteractionEventMethods.MOUSE_MOVE,
      {
        hoveredElement: taggedInformation,
        coordinates: element.getBoundingClientRect(),
      } as any,
      this.targetOrigin
    );

    return true;
  }

  private sendAllElements() {
    const entries = getAllTaggedElements().filter(
      (element) => !!getTaggedInformation(element, this.defaultLocale)
    );

    // FIXME: typing
    sendMessageToEditor(
      'TAGGED_ELEMENTS' as any,
      {
        elements: entries.map((e) => ({
          coordinates: e.getBoundingClientRect(),
        })),
      } as any,
      this.targetOrigin
    );
  }
}
