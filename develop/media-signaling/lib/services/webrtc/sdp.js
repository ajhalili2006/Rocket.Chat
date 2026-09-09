const lineDelimiter = '\r\n';
export class MediaDescription {
    get type() {
        return this._type;
    }
    get content() {
        return this._content;
    }
    get lines() {
        return this._lines;
    }
    constructor(lines) {
        this._type = null;
        this._content = null;
        this._lines = [...lines];
        this.streamIds = [];
        this.parseLines();
    }
    parseLines() {
        for (const line of this.lines) {
            this.parseMediaType(line);
            this.parseStreamId(line);
            this.parseContent(line);
        }
    }
    parseMediaType(line) {
        var _a;
        if (this._type || !line.startsWith('m=')) {
            return;
        }
        this._type = ((_a = line.match(/^m=(\w+)/)) === null || _a === void 0 ? void 0 : _a[1]) || null;
    }
    parseStreamId(line) {
        if (!line.startsWith('a=msid:')) {
            return;
        }
        const streamId = line.slice('a=msid:'.length).split(' ')[0];
        if (!streamId || streamId === '-') {
            return;
        }
        if (this.streamIds.includes(streamId)) {
            return;
        }
        this.streamIds.push(streamId);
    }
    parseContent(line) {
        if (!line.startsWith('a=content:')) {
            return;
        }
        this._content = line.replace('a=content:', '') || null;
    }
    setContent(value) {
        if (this._content === value) {
            return;
        }
        this._content = value || null;
        const lines = this.lines.filter((line) => !line.startsWith('a=content:'));
        this._lines = [...lines, ...(value ? [`a=content:${value}`] : [])];
    }
}
export class SDP {
    constructor(sdp) {
        this.headerLines = [];
        this.medias = [];
        this.parseSDP(sdp);
    }
    addMediaDescription(lines) {
        if (!(lines === null || lines === void 0 ? void 0 : lines.length)) {
            return;
        }
        this.medias.push(new MediaDescription(lines));
    }
    parseSDP(sdp) {
        const allLines = sdp.split(/\r?\n/);
        let currentMediaLines;
        for (const line of allLines) {
            if (line.startsWith('m=')) {
                this.addMediaDescription(currentMediaLines);
                currentMediaLines = [line];
                continue;
            }
            if (!currentMediaLines) {
                this.headerLines.push(line);
                continue;
            }
            currentMediaLines.push(line);
        }
        this.addMediaDescription(currentMediaLines);
    }
    joinLines() {
        const lines = [...this.headerLines, ...this.medias.flatMap(({ lines }) => lines)];
        const delimitedLines = lines.map((line) => {
            if (!line) {
                return line;
            }
            return `${line}${lineDelimiter}`;
        });
        return delimitedLines.join('');
    }
    setContentMediaByStreamId(streamId, content) {
        for (const media of this.medias) {
            if (media.streamIds.includes(streamId)) {
                media.setContent(content);
            }
        }
    }
    static mutateSDPWithStreamContents(sdp, streams) {
        if (!streams.length) {
            return sdp;
        }
        const parsed = new SDP(sdp);
        for (const { id, content } of streams) {
            parsed.setContentMediaByStreamId(id, content);
        }
        return parsed.joinLines();
    }
    /*
     * Returns an object where the key is a stream id and the object is a stream content tag
     */
    static getStreamContentMapFromSDP(sdp) {
        const streams = {};
        const parsed = new SDP(sdp);
        for (const media of parsed.medias) {
            const { streamIds, content } = media;
            if (!streamIds.length || !content) {
                continue;
            }
            for (const id of streamIds) {
                streams[id] = content;
            }
        }
        return streams;
    }
    static getStreamTagByMediaContent(content) {
        switch (content) {
            case 'slides':
                return 'screen-share';
            case 'main':
                return 'main';
            default:
                return null;
        }
    }
}
//# sourceMappingURL=sdp.js.map