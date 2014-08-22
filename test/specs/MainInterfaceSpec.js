describe("Main interface of rasterizeHTML.js", function () {
    var svgImage = "svg image",
        doc, canvas,
        inlineReferences, drawImageOnCanvas;

    var withoutErrors = function () {
        return withErrors([]);
    };

    var withErrors = function (errors) {
        return fulfilled(errors);
    };

    var fulfilled = function (value) {
        var defer = ayepromise.defer();
        defer.resolve(value);
        return defer.promise;
    };

    var rejected = function (error) {
        var defer = ayepromise.defer();
        defer.reject(error);
        return defer.promise;
    };

    var setUpDrawDocumentImage = function (image) {
            render.drawDocumentImage.and.returnValue(fulfilled(image));
        },
        setUpDrawDocumentImageError = function (e) {
            render.drawDocumentImage.and.returnValue(rejected(e));
        };

    var setUpLoadDocument = function () {
            browser.loadDocument.and.returnValue(fulfilled(doc));
        },
        setUpLoadDocumentError = function (e) {
            browser.loadDocument.and.returnValue(rejected(e));
        };

    beforeEach(function () {
        doc = document.implementation.createHTMLDocument('');

        spyOn(browser, 'parseHTML').and.returnValue(doc);

        canvas = document.createElement("canvas");
        canvas.width = 123;
        canvas.height = 456;

        spyOn(util, "parseOptionalParameters").and.callThrough();

        spyOn(render, 'drawDocumentImage');
        spyOn(browser, "loadDocument");
    });

    describe("Rendering", function () {
        var callback;

        beforeEach(function () {
            callback = jasmine.createSpy("drawCallback");

            inlineReferences = spyOn(inlineresources, "inlineReferences").and.returnValue(withoutErrors());
            drawImageOnCanvas = spyOn(render, "drawImageOnCanvas");

            spyOn(documentHelper, 'persistInputValues');

            setUpDrawDocumentImage(svgImage);
        });

        it("should take a document, inline all displayable content and render to the given canvas", function (done) {
            rasterizeHTML.drawDocument(doc, canvas).then(function (result) {
                expect(result.image).toEqual(svgImage);
                expect(result.errors).toEqual([]);

                expect(inlineReferences).toHaveBeenCalledWith(doc, {inlineScripts: false});
                expect(render.drawDocumentImage).toHaveBeenCalledWith(doc, canvas, {});
                expect(drawImageOnCanvas).toHaveBeenCalledWith(svgImage, canvas);

                done();
            });
        });

        it("should make the canvas optional", function (done) {
            rasterizeHTML.drawDocument(doc).then(function (result) {
                expect(result.image).toEqual(svgImage);

                expect(inlineReferences).toHaveBeenCalledWith(doc, {inlineScripts : false});
                expect(render.drawDocumentImage).toHaveBeenCalledWith(doc, null, {});
                expect(drawImageOnCanvas).not.toHaveBeenCalled();

                expect(util.parseOptionalParameters).toHaveBeenCalled();

                done();
            });
        });

        it("should pass on AJAX options", function (done) {
            rasterizeHTML.drawDocument(doc, canvas, {baseUrl: "a_baseUrl", cache: 'none', cacheBucket: {}}).then(function () {
                expect(inlineReferences).toHaveBeenCalledWith(doc, {baseUrl: "a_baseUrl", cache: 'none', cacheBucket: {}, inlineScripts : false});

                done();
            });
        });

        it("should pass on render options", function (done) {
            rasterizeHTML.drawDocument(doc, canvas, {width: 123, height: 234, hover: '.aSelector', active: '#anotherSelector', zoom: 42}).then(function () {
                expect(render.drawDocumentImage).toHaveBeenCalledWith(doc, canvas, {width: 123, height: 234, hover: '.aSelector', active: '#anotherSelector', zoom: 42});

                done();
            });
        });

        it("should provide a callback for legacy reasons for drawDocument", function (done) {
            rasterizeHTML.drawDocument(doc, canvas, function (image, errors) {
                expect(image).toEqual(svgImage);
                expect(errors).toEqual([]);

                done();
            });
        });

        it("should optionally execute JavaScript in the page", function (done) {
            var executeJavascript = spyOn(browser, "executeJavascript").and.returnValue(
                    fulfilled({document: doc, errors: []})
                );

            rasterizeHTML.drawDocument(doc, {executeJs: true, width: 123, height: 456}).then(function () {
                expect(executeJavascript).toHaveBeenCalledWith(doc, undefined, 0, {width: 123, height: 456});
                expect(documentHelper.persistInputValues).toHaveBeenCalledWith(doc);

                done();
            });
        });

        it("should inline scripts when executing JavaScript", function (done) {
            spyOn(browser, "executeJavascript").and.returnValue(
                fulfilled({document: doc, errors: []})
            );

            rasterizeHTML.drawDocument(doc, {executeJs: true}).then(function () {
                expect(inlineReferences).toHaveBeenCalledWith(doc, {executeJs : true, inlineScripts: true});

                done();
            });
        });

        it("should follow optional timeout when executing JavaScript", function (done) {
            var executeJavascript = spyOn(browser, "executeJavascript").and.returnValue(
                    fulfilled({document: doc, errors: []})
                );


            rasterizeHTML.drawDocument(doc, {executeJs: true, executeJsTimeout: 42}).then(function () {
                expect(executeJavascript).toHaveBeenCalledWith(doc, undefined, 42, jasmine.any(Object));

                done();
            });
        });

        it("should take a HTML string, inline all displayable content and render to the given canvas", function (done) {
            var html = "<head><title>a title</title></head><body>some html</body>",
                drawDocumentSpy = spyOn(rasterizeHTML, "drawDocument").and.returnValue(fulfilled({
                    image: svgImage,
                    errors: []
                }));

            browser.parseHTML.and.callFake(function (someHtml) {
                if (someHtml === html) {
                    return doc;
                }
            });

            rasterizeHTML.drawHTML(html, canvas).then(function (result) {
                expect(result.image).toEqual(svgImage);
                expect(result.errors).toEqual([]);

                expect(drawDocumentSpy).toHaveBeenCalledWith(doc, canvas, {}, null);

                done();
            });
        });

        it("should provide a callback for legacy reasons for drawHTML", function (done) {
            var drawDocumentSpy = spyOn(rasterizeHTML, "drawDocument").and.callFake(function (document, canvas, options, callback) {
                    callback(svgImage, []);
                    return fulfilled({
                        image: svgImage,
                        errors: []
                    });
                });

            rasterizeHTML.drawHTML("some html", canvas, function (image, errors) {
                expect(image).toEqual(svgImage);
                expect(errors).toEqual([]);

                expect(drawDocumentSpy).toHaveBeenCalledWith(doc, canvas, {}, jasmine.any(Function));

                done();
            });
        });

        it("should make the canvas optional when drawing a HTML string", function (done) {
            var html = "the html",
                drawDocumentSpy = spyOn(rasterizeHTML, "drawDocument").and.returnValue(fulfilled({
                    image: svgImage,
                    errors: []
                }));

            rasterizeHTML.drawHTML(html, {width: 999, height: 987}).then(function (result) {
                expect(result.image).toEqual(svgImage);
                expect(drawDocumentSpy).toHaveBeenCalledWith(jasmine.any(Object), null, {width: 999, height: 987}, null);

                done();
            });
        });

        it("should take a HTML string with optional baseUrl, inline all displayable content and render to the given canvas", function (done) {
            var html = "the html",
                drawDocumentSpy = spyOn(rasterizeHTML, "drawDocument").and.returnValue(fulfilled({
                    image: svgImage,
                    errors: []
                }));

            rasterizeHTML.drawHTML(html, canvas, {baseUrl: "a_baseUrl"}).then(function () {
                expect(drawDocumentSpy).toHaveBeenCalledWith(jasmine.any(Object), canvas, {baseUrl: "a_baseUrl"}, null);

                done();
            });
        });

        it("should circumvent caching if requested for drawHTML", function (done) {
            var html = "<head><title>a title</title></head><body>some html</body>",
                drawDocumentSpy = spyOn(rasterizeHTML, "drawDocument").and.returnValue(fulfilled({
                    image: svgImage,
                    errors: []
                }));

            rasterizeHTML.drawHTML(html, canvas, {cache: 'none'}).then(function () {
                expect(drawDocumentSpy).toHaveBeenCalledWith(jasmine.any(Object), canvas, {cache: 'none'}, null);

                done();
            });
        });

        it("should take a URL, inline all displayable content and render to the given canvas", function (done) {
            var drawDocumentSpy = spyOn(rasterizeHTML, "drawDocument").and.returnValue(fulfilled({
                    image: svgImage,
                    errors: []
                }));

            setUpLoadDocument();

            var documentElement = doc.documentElement;

            rasterizeHTML.drawURL("fixtures/image.html", canvas).then(function (result) {
                expect(result.image).toEqual(svgImage);
                expect(result.errors).toEqual([]);

                expect(drawDocumentSpy).toHaveBeenCalledWith(jasmine.any(Object), canvas, jasmine.any(Object));
                expect(drawDocumentSpy.calls.mostRecent().args[0].documentElement).toBe(documentElement);

                done();
            });
        });

        it("should provide a callback for legacy reasons for drawURL", function (done) {
            var drawDocumentSpy = spyOn(rasterizeHTML, "drawDocument").and.returnValue(fulfilled({
                    image: svgImage,
                    errors: []
                }));

            setUpLoadDocument();

            rasterizeHTML.drawURL("fixtures/image.html", canvas, function (image, errors) {
                expect(image).toEqual(svgImage);
                expect(errors).toEqual([]);

                expect(drawDocumentSpy).toHaveBeenCalledWith(jasmine.any(Object), canvas, jasmine.any(Object));

                done();
            });
        });

        it("should make the canvas optional when drawing an URL", function (done) {
            var drawDocumentSpy = spyOn(rasterizeHTML, "drawDocument").and.returnValue(fulfilled({
                    image: svgImage,
                    errors: []
                }));

            setUpLoadDocument();

            rasterizeHTML.drawURL("fixtures/image.html", {width: 999, height: 987}).then(function (result) {
                expect(result.image).toEqual(svgImage);
                expect(drawDocumentSpy).toHaveBeenCalledWith(jasmine.any(Object), null, jasmine.objectContaining({width: 999, height: 987}));

                done();
            });
        });

        it("should circumvent caching if requested for drawURL", function (done) {
            spyOn(rasterizeHTML, "drawDocument").and.returnValue(fulfilled({
                image: svgImage,
                errors: []
            }));

            setUpLoadDocument();

            rasterizeHTML.drawURL("fixtures/image.html", canvas, {cache: 'none'}).then(function () {
                expect(browser.loadDocument).toHaveBeenCalledWith("fixtures/image.html", {
                    cache: 'none'
                });

                done();
            });
        });
    });

    describe("Error handling", function () {
        var callback;

        beforeEach(function () {
            callback = jasmine.createSpy("drawCallback");

            drawImageOnCanvas = spyOn(render, "drawImageOnCanvas");
            spyOn(documentHelper, 'persistInputValues');
        });

        it("should pass through errors from inlining on drawURL", function (done) {
            setUpDrawDocumentImage(svgImage);
            spyOn(inlineresources, "inlineReferences").and.returnValue(withErrors(["the error"]));

            setUpLoadDocument();

            rasterizeHTML.drawURL("some.html", canvas).then(function (result) {
                expect(result.errors).toEqual(["the error"]);

                done();
            });
        });

        it("should pass through an error from inlining on drawDocument", function (done) {
            setUpDrawDocumentImage(svgImage);

            inlineReferences = spyOn(inlineresources, "inlineReferences").and.returnValue(withErrors(["the error"]));

            rasterizeHTML.drawDocument(doc, canvas).then(function (result) {
                expect(result.image).toEqual(svgImage);
                expect(result.errors).toEqual(["the error"]);

                expect(inlineReferences).toHaveBeenCalled();

                done();
            });
        });

        it("should pass through errors to drawHTML", function (done) {
            spyOn(rasterizeHTML, "drawDocument").and.returnValue(fulfilled({
                errors: ["an error"]
            }));

            rasterizeHTML.drawHTML("", canvas).then(function (result) {
                expect(result.errors).toEqual(["an error"]);

                done();
            });
        });

        it("should pass through errors to drawURL", function (done) {
            spyOn(rasterizeHTML, "drawDocument").and.returnValue(fulfilled({
                errors: ["some error"]
            }));

            setUpLoadDocument();

            rasterizeHTML.drawURL("fixtures/image.html", canvas).then(function (result) {
                expect(result.errors).toEqual(["some error"]);

                done();
            });
        });

        it("should pass through a JS error", function (done) {
            spyOn(inlineresources, "inlineReferences").and.returnValue(withoutErrors());
            spyOn(browser, "executeJavascript").and.returnValue(
                fulfilled({document: doc, errors: ["the error"]})
            );
            setUpDrawDocumentImage(svgImage);

            rasterizeHTML.drawDocument(doc, canvas, {executeJs: true}).then(function (result) {
                expect(result.image).toBe(svgImage);
                expect(result.errors).toEqual(["the error"]);

                done();
            });
        });

        it("should report an error through callback for legacy reasons on loading a broken URL", function (done) {
            setUpLoadDocumentError({message: "the message"});

            rasterizeHTML.drawURL("non_existing.html", canvas, function (image, errors) {
                expect(image).toBe(null);
                expect(errors).toEqual([jasmine.objectContaining({
                    resourceType: "page",
                    url: "non_existing.html",
                    msg: "the message" + " non_existing.html"
                })]);

                expect(browser.loadDocument).toHaveBeenCalled();

                done();
            });
        });

        it("should report an error on loading a broken URL", function (done) {
            setUpLoadDocumentError("the error");

            rasterizeHTML.drawURL("non_existing.html", canvas).fail(function (e) {
                expect(e).toEqual("the error");

                done();
            });
        });
    });

    describe("Internal errors", function () {
        var callback, executeJavascript;

        beforeEach(function () {
            callback = jasmine.createSpy("drawCallback");

            inlineReferences = spyOn(inlineresources, "inlineReferences").and.returnValue(withoutErrors());

            drawImageOnCanvas = spyOn(render, "drawImageOnCanvas");

            executeJavascript = spyOn(browser, "executeJavascript");
            spyOn(documentHelper, 'persistInputValues');
        });

        it("should fail the returned promise on error from inlining when rendering the SVG on drawDocument", function (done) {
            var error = new Error();

            setUpDrawDocumentImageError(error);

            rasterizeHTML.drawDocument(doc, canvas).fail(function (e) {
                expect(e).toBe(error);

                expect(drawImageOnCanvas).not.toHaveBeenCalled();

                done();
            });
        });

        it("should pass through an error from inlining to the callback for legacy reasons when rendering the SVG on drawDocument", function (done) {
            setUpDrawDocumentImageError();

            rasterizeHTML.drawDocument(doc, canvas, function (image, errors) {
                expect(drawImageOnCanvas).not.toHaveBeenCalled();
                expect(image).toBe(null);
                expect(errors).toEqual([jasmine.objectContaining({
                    resourceType: "document",
                    msg: "Error rendering page"
                })]);

                done();
            });
        });

        it("should fail the returned promise on error from inlining when drawing the image on the canvas on drawDocument", function (done) {
            var error = new Error("theError");

            setUpDrawDocumentImage(svgImage);
            drawImageOnCanvas.and.throwError(error);

            rasterizeHTML.drawDocument(doc, canvas).fail(function (e) {
                expect(e).toBe(error);

                expect(drawImageOnCanvas).toHaveBeenCalled();

                done();
            });
        });

        it("should pass through an error from inlining to the callback for legacy reasons when drawing the image on the canvas on drawDocument", function (done) {
            setUpDrawDocumentImage(svgImage);
            drawImageOnCanvas.and.throwError({});

            rasterizeHTML.drawDocument(doc, canvas, function (image, errors) {
                expect(image).toBe(null);
                expect(errors).toEqual([jasmine.objectContaining({
                    resourceType: "document",
                    msg: "Error rendering page"
                })]);

                expect(drawImageOnCanvas).toHaveBeenCalled();

                done();
            });
        });
    });
});
