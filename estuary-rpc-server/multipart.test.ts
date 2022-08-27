import { IncomingMessage } from "http";
import { MultiPartParser } from "./multipart";

test.each`
  description                    | expectation                                                       | value                                                                                                                            | persist  | rawStrings
  ${"Parses simple form"}        | ${{ test: "test" }}                                               | ${'--BND#Content-Disposition: form-data; name="test"##test#--BND--#'}                                                            | ${false} | ${true}
  ${"Doesn't persist values"}    | ${{ test: "test" }}                                               | ${'--BND#Content-Disposition: form-data; name="test"##test#--BND--#'}                                                            | ${true}  | ${true}
  ${"Ignores header case"}       | ${{ test: "test" }}                                               | ${'--BND#content-DiSpOsiTiOn: foRM-DAta; name="test"##test#--BND--#'}                                                            | ${false} | ${true}
  ${"Skips invalid JSON"}        | ${{}}                                                             | ${'--BND#Content-Disposition: form-data; name="test"##test#--BND--#'}                                                            | ${false} | ${false}
  ${"Parses JSON"}               | ${{ test: "test" }}                                               | ${'--BND#Content-Disposition: form-data; name="test"##"test"#--BND--#'}                                                          | ${false} | ${false}
  ${"Parses nested JSON"}        | ${{ test: { a: { nest: ["of", "vals"] } } }}                      | ${'--BND#Content-Disposition: form-data; name="test"##{"a":{"nest": ["of", "vals"]}}#--BND--#'}                                  | ${false} | ${false}
  ${"Parses multiform"}          | ${{ test: "test", foo: "foo" }}                                   | ${'--BND#Content-Disposition: form-data; name="test"##test#--BND#Content-Disposition: form-data; name="foo"##foo#--BND--#'}      | ${false} | ${true}
  ${"Deals with chunks"}         | ${{ test: "test" }}                                               | ${'--BND#Content-Dispositi@on: form-data; nam@e="test"##tes@t#--BND--#'}                                                         | ${false} | ${true}
  ${"Deals with lots of chunks"} | ${{ test: "test", foo: "foo" }}                                   | ${'--BN@D#Content-Disposition: form-data; name="test"##te@st#--BND@#Content-Disposition: form-data@; name="foo"##foo#--BND--@#'} | ${false} | ${true}
  ${"Parses file"}               | ${{ test: { contentType: "application/text", content: "test" } }} | ${'--BND#Content-Disposition: form-data; name="test"; filename="foo.txt"##test#--BND--#'}                                        | ${false} | ${true}
  ${"Parses content type"}       | ${{ test: { contentType: "text/plain", content: "test" } }}       | ${'--BND#Content-Disposition: form-data; name="test"; filename="foo.txt"#Content-Type: text/plain##test#--BND--#'}               | ${false} | ${true}
`(
  "$description; Parses $value as $expectation",
  async ({ value, persist, rawStrings, expectation }) => {
    const parser = new MultiPartParser(
      {
        headers: {
          "content-type": "multipart/form-data; boundary=BND",
        },
      } as unknown as IncomingMessage,
      persist,
      rawStrings
    );
    // Split into specific "chunks" on all @s
    for (const chunk of value.split("@")) {
      // Replace '#' with '\r\n'
      await parser.parse(chunk.split("#").join("\r\n"));
    }
    expect(parser.get()).toMatchObject(expectation);
  }
);
