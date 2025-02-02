
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as data from "./data";
import * as marked from "marked";

type ISettingsProps = pxt.editor.ISettingsProps;

interface MarkedContentProps extends ISettingsProps {
    markdown: string;
    className?: string;
}

interface MarkedContentState {
}

export class MarkedContent extends data.Component<MarkedContentProps, MarkedContentState> {

    // Local cache for images, cleared when we create a new project.
    // Stores code => data-uri image of decompiled result
    private static blockSnippetCache: pxt.Map<string> = {};
    public static clearBlockSnippetCache() {
        this.blockSnippetCache = {};
    }

    private getBuiltinMacros() {
        const params: pxt.Map<string> = {};
        const theme = pxt.appTarget.appTheme;
        if (theme.boardName)
            params["boardname"] = pxt.Util.htmlEscape(theme.boardName);
        if (theme.boardNickname)
            params["boardnickname"] = pxt.Util.htmlEscape(theme.boardNickname);
        if (theme.driveDisplayName)
            params["drivename"] = pxt.Util.htmlEscape(theme.driveDisplayName);
        if (theme.homeUrl)
            params["homeurl"] = pxt.Util.htmlEscape(theme.homeUrl);
        params["targetid"] = theme.id || "???";
        params["targetname"] = theme.name || "Microsoft MakeCode";
        params["targetlogo"] = theme.docsLogo ? `<img aria-hidden="true" role="presentation" class="ui mini image" src="${theme.docsLogo}" />` : "";
        return params;
    }

    private startRenderLangSnippet(langBlock: HTMLElement): HTMLDivElement {
        const preBlock = langBlock.parentElement as HTMLPreElement; // pre parent of the code
        const parentBlock = preBlock.parentElement as HTMLDivElement; // parent containing all text

        const wrapperDiv = document.createElement('div');
        wrapperDiv.className = 'ui segment raised loading';
        parentBlock.insertBefore(wrapperDiv, preBlock);
        parentBlock.removeChild(preBlock);

        return wrapperDiv;
    }

    private finishRenderLangSnippet(wrapperDiv: HTMLDivElement, code: string) {
        const preDiv = document.createElement('pre') as HTMLPreElement;
        preDiv.textContent = code;
        pxt.tutorial.highlight(preDiv);
        wrapperDiv.appendChild(preDiv);
        pxsim.U.removeClass(wrapperDiv, 'loading');
    }

    private renderSnippets(content: HTMLElement) {
        const { parent } = this.props;

        pxt.Util.toArray(content.querySelectorAll(`code.lang-typescript`))
            .forEach((langBlock: HTMLElement) => {
                const code = langBlock.textContent;
                const wrapperDiv = this.startRenderLangSnippet(langBlock);
                this.finishRenderLangSnippet(wrapperDiv, code);
            });

        pxt.Util.toArray(content.querySelectorAll(`code.lang-spy`))
            .forEach((langBlock: HTMLElement) => {
                const code = langBlock.textContent;
                const wrapperDiv = this.startRenderLangSnippet(langBlock);
                if (MarkedContent.blockSnippetCache[code]) {
                    this.finishRenderLangSnippet(wrapperDiv, MarkedContent.blockSnippetCache[code]);
                } else {
                    parent.renderPythonAsync({
                        type: "pxteditor",
                        action: "renderpython", ts: code
                    }).done(resp => {
                        MarkedContent.blockSnippetCache[code] = resp.python;
                        this.finishRenderLangSnippet(wrapperDiv, MarkedContent.blockSnippetCache[code]);
                    });
                }
            });

        pxt.Util.toArray(content.querySelectorAll(`code.lang-blocks`))
            .forEach((langBlock: HTMLElement) => {
                // Can't use innerHTML here because it escapes certain characters (e.g. < and >)
                // Also can't use innerText because IE strips out the newlines from the code
                // textContent seems to work in all browsers and return the "pure" text
                const code = langBlock.textContent;

                const wrapperDiv = document.createElement('div');
                pxsim.U.clear(langBlock);
                langBlock.appendChild(wrapperDiv);
                wrapperDiv.className = 'ui segment raised loading';
                if (MarkedContent.blockSnippetCache[code]) {
                    // Use cache
                    const svg = Blockly.Xml.textToDom(pxt.blocks.layout.serializeSvgString(MarkedContent.blockSnippetCache[code]));
                    wrapperDiv.appendChild(svg);
                    pxsim.U.removeClass(wrapperDiv, 'loading');
                } else {
                    parent.renderBlocksAsync({
                        type: "pxteditor",
                        action: "renderblocks", ts: code
                    })
                        .done(resp => {
                            const svg = resp.svg;
                            if (svg) {
                                const viewBox = svg.getAttribute('viewBox').split(' ').map(parseFloat);
                                const width = viewBox[2];
                                let height = viewBox[3];
                                if (width > 480 || height > 128)
                                    height = (height * 0.8) | 0;
                                svg.setAttribute('height', `${height}px`);
                                // SVG serialization is broken on IE (SVG namespace issue), don't cache on IE
                                if (!pxt.BrowserUtils.isIE()) MarkedContent.blockSnippetCache[code] = Blockly.Xml.domToText(svg);
                                wrapperDiv.appendChild(svg);
                                pxsim.U.removeClass(wrapperDiv, 'loading');
                            } else {
                                // An error occured, show alternate message
                                const textDiv = document.createElement('span');
                                textDiv.textContent = lf("Oops, something went wrong trying to render this block snippet.");
                                wrapperDiv.appendChild(textDiv);
                                pxsim.U.removeClass(wrapperDiv, 'loading');
                            }
                        })
                }
            })
        pxt.Util.toArray(content.querySelectorAll(`code.lang-diffblocksxml`))
            .forEach((langBlock: HTMLElement) => {
                // Can't use innerHTML here because it escapes certain characters (e.g. < and >)
                // Also can't use innerText because IE strips out the newlines from the code
                // textContent seems to work in all browsers and return the "pure" text
                const code = langBlock.textContent;
                const xml = langBlock.textContent.split(/-{10,}/);
                const oldXml = xml[0];
                const newXml = xml[1];

                const wrapperDiv = document.createElement('div');
                pxsim.U.clear(langBlock);
                langBlock.appendChild(wrapperDiv);

                pxt.BrowserUtils.loadBlocklyAsync()
                    .then(() => {
                        const diff = pxt.blocks.diffXml(oldXml, newXml);
                        const svg = diff.svg;
                        if (svg) {
                            if (svg.tagName == "SVG") { // splitsvg
                                const viewBox = svg.getAttribute('viewBox').split(' ').map(parseFloat);
                                const width = viewBox[2];
                                let height = viewBox[3];
                                if (width > 480 || height > 128)
                                    height = (height * 0.8) | 0;
                                svg.setAttribute('height', `${height}px`);
                            }
                            // SVG serialization is broken on IE (SVG namespace issue), don't cache on IE
                            if (!pxt.BrowserUtils.isIE()) MarkedContent.blockSnippetCache[code] = Blockly.Xml.domToText(svg);
                            wrapperDiv.appendChild(svg);
                            pxsim.U.removeClass(wrapperDiv, 'loading');
                        } else {
                            // An error occured, show alternate message
                            const textDiv = document.createElement('div');
                            textDiv.className = "ui basic segment";
                            textDiv.textContent = diff.message || lf("No changes.");
                            wrapperDiv.appendChild(textDiv);
                            pxsim.U.removeClass(wrapperDiv, 'loading');
                        }
                    });
            });
    }

    private renderInlineBlocks(content: HTMLElement) {
        pxt.Util.toArray(content.querySelectorAll(`:not(pre) > code`))
            .forEach((inlineBlock: HTMLElement) => {
                const text = inlineBlock.innerText;
                const mbtn = /^(\|+)([^\|]+)\|+$/.exec(text);
                if (mbtn) {
                    const mtxt = /^(([^\:\.]*?)[\:\.])?(.*)$/.exec(mbtn[2]);
                    const ns = mtxt[2] ? mtxt[2].trim().toLowerCase() : '';
                    const txt = mtxt[3].trim();
                    const lev = mbtn[1].length == 1 ?
                        `docs inlinebutton ui button ${pxt.Util.htmlEscape(txt.toLowerCase())}-button`
                        : `docs inlineblock ${pxt.Util.htmlEscape(ns)}`;

                    const inlineBlockDiv = document.createElement('span');
                    pxsim.U.clear(inlineBlock);
                    inlineBlock.appendChild(inlineBlockDiv);
                    inlineBlockDiv.className = lev;
                    inlineBlockDiv.textContent = pxt.U.rlf(txt);
                }
            })
    }

    private renderOthers(content: HTMLElement) {
        // remove package blocks
        pxt.Util.toArray(content.querySelectorAll(`.lang-package,.lang-config`))
            .forEach((langBlock: HTMLElement) => {
                langBlock.parentNode.removeChild(langBlock);
            });
    }

    renderMarkdown(markdown: string) {
        const content = this.refs["marked-content"] as HTMLDivElement;
        const pubinfo = this.getBuiltinMacros();

        // replace pre-template in markdown
        markdown = markdown.replace(/@([a-z]+)@/ig, (m, param) => pubinfo[param] || 'unknown macro')

        // create a custom renderer
        let renderer = new marked.Renderer()
        pxt.docs.setupRenderer(renderer);

        // Set markdown options
        marked.setOptions({
            renderer: renderer,
            sanitize: true
        })

        // Render the markdown and add it to the content div
        /* tslint:disable:no-inner-html (marked content is already sanitized) */
        content.innerHTML = marked(markdown);
        /* tslint:enable:no-inner-html */

        // We'll go through a series of adjustments here, rendering inline blocks, blocks and snippets as needed
        this.renderInlineBlocks(content);
        this.renderSnippets(content);
        this.renderOthers(content);
    }

    componentDidMount() {
        const { markdown } = this.props;
        this.renderMarkdown(markdown);
    }

    componentWillReceiveProps(newProps: MarkedContentProps) {
        const { markdown } = newProps;
        if (this.props.markdown != newProps.markdown) {
            this.renderMarkdown(markdown);
        }
    }

    renderCore() {
        const { className } = this.props;
        return <div ref="marked-content" className={className || ""} />;
    }
}