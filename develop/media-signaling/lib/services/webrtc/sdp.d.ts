type MediaContent = 'slides' | 'speaker' | 'sl' | 'main' | 'alt';
type StreamContent = {
    id: string;
    content: MediaContent;
};
export declare class MediaDescription {
    private _lines;
    readonly streamIds: string[];
    private _type;
    private _content;
    get type(): string | null;
    get content(): string | null;
    get lines(): string[];
    constructor(lines: string[]);
    private parseLines;
    private parseMediaType;
    private parseStreamId;
    private parseContent;
    setContent(value: MediaContent | null): void;
}
export declare class SDP {
    private headerLines;
    readonly medias: MediaDescription[];
    constructor(sdp: string);
    private addMediaDescription;
    private parseSDP;
    joinLines(): string;
    setContentMediaByStreamId(streamId: string, content: MediaContent): void;
    static mutateSDPWithStreamContents(sdp: string, streams: StreamContent[]): string;
    static getStreamContentMapFromSDP(sdp: string): Record<string, string>;
    static getStreamTagByMediaContent(content: string): string | null;
}
export {};
//# sourceMappingURL=sdp.d.ts.map