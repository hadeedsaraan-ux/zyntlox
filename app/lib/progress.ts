import { ProgressStage, StreamEvent } from "./types";

export function createProgressStream<T>() {
  const encoder = new TextEncoder();
  let controllerRef!: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
  });

  const write = (event: StreamEvent<T>) => {
    controllerRef.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
  };

  return {
    stream,
    sendStage: (stage: ProgressStage) => write({ type: "stage", stage }),
    sendResult: (data: T) => {
      write({ type: "result", data });
      controllerRef.close();
    },
    sendError: (error: string) => {
      write({ type: "error", error });
      controllerRef.close();
    },
  };
}
