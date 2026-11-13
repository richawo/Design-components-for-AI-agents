import { ArrowUpRight } from "lucide-react";
import { localizePath } from "@/lib/i18n/routing";
import { serverI18n } from "@/lib/i18n/server";
import { blogExampleComponent } from "@/lib/blog/examples";
import { BlogRecording } from "./blog-recording";
import { BlogStateExample, type BlogStateFixture } from "./blog-state-example";
import { BlogTrace } from "./blog-trace";

const mastheadExamples: Partial<Record<string, "trace" | BlogStateFixture["kind"]>> = {
  "react-agent-run-trace-ui": "trace",
  "react-ai-answer-citations": "citations",
  "react-ai-model-selector": "model",
  "react-ai-prompt-input-attachments": "attachments",
  "react-ai-voice-interface": "voice",
};

export async function blogExample(sourceSlug: string, markdown: string, locale: string) {
  const component = blogExampleComponent(sourceSlug, markdown);
  if (!component) return null;
  const kind = mastheadExamples[sourceSlug] ?? "recording";
  if (kind === "recording" && !component.thumb) return null;

  const { t } = await serverI18n(locale);
  const title = t(component.name);
  let fixture: BlogStateFixture | undefined;
  switch (kind) {
    case "citations":
      fixture = { kind: "citations", labels: { sources: t("Sources"), unavailable: t("Source unavailable") } };
      break;
    case "model":
      fixture = { kind: "model", labels: { model: t("Model"), text: t("Text"), image: t("Image"), supported: t("Image supported"), unsupported: t("Image unsupported") } };
      break;
    case "attachments":
      fixture = { kind: "attachments", labels: {
        selected: t("Selected"), uploading: t("Uploading"), ready: t("Ready"), removed: t("Removed"),
        upload: t("Upload"), remove: t("Remove"), retry: t("Retry"),
      } };
      break;
    case "voice":
      fixture = { kind: "voice", labels: { transcript: t("Reply transcript"), stop: t("Interrupt reply"), replay: t("Reset example"), stopped: t("Playback stopped") } };
      break;
  }

  const element = (
    <figure className="blog-example" aria-label={kind === "recording" ? t("Component recording") : t("Interactive example")} data-blog-example={kind}>
      {kind === "trace" ? (
        <BlogTrace labels={{
          timeline: t("Trace timeline"), elapsed: t("Elapsed time"), total: t("Sum of child spans"),
          play: t("Play timeline"), pause: t("Pause timeline"), replay: t("Replay timeline"), failed: t("Failed"),
          completed: t("Completed"), running: t("Running"), pending: t("Pending"),
        }} />
      ) : fixture ? (
        <BlogStateExample example={fixture} />
      ) : (
        <BlogRecording
          name={title}
          media={{ thumb: component.thumb, srcSet: component.thumbSrcSet, video: component.video }}
          styles={component.styleMedia}
          labels={{ play: t("Play recording"), retry: t("Retry"), error: t("Video unavailable") }}
        />
      )}
      <figcaption>
        <a href={localizePath(component.path, locale)}>{title}<ArrowUpRight size={15} aria-hidden="true" /></a>
      </figcaption>
    </figure>
  );
  return { masthead: kind !== "recording", element };
}
